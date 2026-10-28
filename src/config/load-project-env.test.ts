import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadProjectEnvFiles } from "@/config/load-project-env";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("loadProjectEnvFiles", () => {
  it("loads POSTGRES_URL from .env.local when unset in the process env", () => {
    const dir = mkdtempSync(join(tmpdir(), "paisa-watch-env-"));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, ".env.local"),
      "POSTGRES_URL=postgres://avnadmin:secret@example.aivencloud.com:23490/defaultdb?sslmode=require\n"
    );

    const env: Record<string, string | undefined> = {};
    loadProjectEnvFiles(dir, env);

    expect(env.POSTGRES_URL).toBe(
      "postgres://avnadmin:secret@example.aivencloud.com:23490/defaultdb?sslmode=require"
    );
  });

  it("lets .env.local override .env, but does not override already-set process env", () => {
    const dir = mkdtempSync(join(tmpdir(), "paisa-watch-env-"));
    tempDirs.push(dir);
    writeFileSync(join(dir, ".env"), "POSTGRES_URL=from-env\nOTHER=from-env\n");
    writeFileSync(join(dir, ".env.local"), "POSTGRES_URL=from-local\n");

    const env: Record<string, string | undefined> = { POSTGRES_URL: "from-shell" };
    loadProjectEnvFiles(dir, env);

    expect(env.POSTGRES_URL).toBe("from-shell");
    expect(env.OTHER).toBe("from-env");
  });

  it("accepts the export KEY=value form", () => {
    const dir = mkdtempSync(join(tmpdir(), "money-watch-env-"));
    tempDirs.push(dir);
    writeFileSync(join(dir, ".env"), 'export POSTGRES_URL=from-export\nexport QUOTED="spaced value"\n');

    const env: Record<string, string | undefined> = {};
    loadProjectEnvFiles(dir, env);

    expect(env.POSTGRES_URL).toBe("from-export");
    expect(env.QUOTED).toBe("spaced value");
  });

  it("ignores missing env files", () => {
    const dir = mkdtempSync(join(tmpdir(), "paisa-watch-env-"));
    tempDirs.push(dir);
    mkdirSync(join(dir, "nested"));

    const env: Record<string, string | undefined> = {};
    expect(() => loadProjectEnvFiles(dir, env)).not.toThrow();
    expect(env.POSTGRES_URL).toBeUndefined();
  });
});
