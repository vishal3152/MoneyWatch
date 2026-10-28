import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { closeSharedDb, createDb, getSharedDb } from "@/db/client";
import { DatabaseError } from "@/db/errors";
import { InstitutionRepository } from "@/db/repositories/institution-repository";

describe("createDb", () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  const originalMigrationsFolder = process.env.MIGRATIONS_FOLDER;
  const tempRoots: string[] = [];

  afterEach(() => {
    closeSharedDb();

    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }

    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }

    if (originalMigrationsFolder === undefined) {
      delete process.env.MIGRATIONS_FOLDER;
    } else {
      process.env.MIGRATIONS_FOLDER = originalMigrationsFolder;
    }
  });

  it("opens the default project-local database when DATABASE_PATH is missing", async () => {
    delete process.env.DATABASE_PATH;

    const root = mkdtempSync(join(tmpdir(), "paisa-watch-client-"));
    tempRoots.push(root);
    const databasePath = join(root, "paisa-watch.db");

    const db = createDb(databasePath);
    const institutions = new InstitutionRepository(db);

    await institutions.create({ id: "inst-1", name: "HDFC" });
    await expect(institutions.getById("inst-1")).resolves.toEqual({ id: "inst-1", name: "HDFC" });
  });

  it("returns a typed error when SQLite cannot open the configured path", () => {
    const directory = mkdtempSync(join(tmpdir(), "paisa-watch-client-"));
    tempRoots.push(directory);

    expect(() => createDb(directory)).toThrow(DatabaseError);
  });

  it("returns a typed error when the database's parent directory cannot be created", () => {
    const root = mkdtempSync(join(tmpdir(), "paisa-watch-client-"));
    tempRoots.push(root);
    const blockingFile = join(root, "blocker");
    writeFileSync(blockingFile, "not a directory");
    const databasePath = join(blockingFile, "nested", "paisa-watch.db");

    expect(() => createDb(databasePath)).toThrow(DatabaseError);
  });

  it("honors MIGRATIONS_FOLDER when set", () => {
    const root = mkdtempSync(join(tmpdir(), "paisa-watch-client-"));
    tempRoots.push(root);
    const databasePath = join(root, "paisa-watch.db");
    process.env.MIGRATIONS_FOLDER = join(root, "missing-migrations");

    expect(() => createDb(databasePath)).toThrow(DatabaseError);
  });

  it("reuses one shared database connection for the same resolved path", () => {
    const root = mkdtempSync(join(tmpdir(), "paisa-watch-client-"));
    tempRoots.push(root);
    const databasePath = join(root, "paisa-watch.db");

    expect(getSharedDb(databasePath)).toBe(getSharedDb(databasePath));
  });

  it("keeps shared connections separate for different database paths", () => {
    const root = mkdtempSync(join(tmpdir(), "paisa-watch-client-"));
    tempRoots.push(root);

    expect(getSharedDb(join(root, "one.db"))).not.toBe(getSharedDb(join(root, "two.db")));
  });

  it("opens a fresh shared connection after the previous one is closed", () => {
    const root = mkdtempSync(join(tmpdir(), "paisa-watch-client-"));
    tempRoots.push(root);
    const databasePath = join(root, "paisa-watch.db");
    const beforeClose = getSharedDb(databasePath);

    closeSharedDb(databasePath);

    expect(getSharedDb(databasePath)).not.toBe(beforeClose);
  });
});
