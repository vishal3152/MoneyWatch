import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

// Local SQLite wiring: Drizzle over better-sqlite3. Connections are shared
// per resolved path via a global map (survives Next.js HMR), and each path is
// migrated once per process. Cloud/Postgres modules must stay out of this
// graph (bundling invariant) — cross-tier code uses dynamic import() instead.
import { resolveDatabasePath } from "@/config/resolve-database-path";
import { DatabaseError } from "@/db/errors";
import * as schema from "@/db/schema";

export type DrizzleDb = BetterSQLite3Database<typeof schema>;

const migratedPaths = new Set<string>();
const GLOBAL_DATABASES_KEY = "__moneyWatchSqliteDatabases";

type SharedDatabase = {
  sqlite: Database.Database;
  db: DrizzleDb;
};

type GlobalWithDatabases = typeof globalThis & {
  [GLOBAL_DATABASES_KEY]?: Map<string, SharedDatabase>;
};

function getSharedDatabases(): Map<string, SharedDatabase> {
  const globalWithDatabases = globalThis as GlobalWithDatabases;
  if (!globalWithDatabases[GLOBAL_DATABASES_KEY]) {
    globalWithDatabases[GLOBAL_DATABASES_KEY] = new Map();
  }
  return globalWithDatabases[GLOBAL_DATABASES_KEY];
}

function resolveMigrationsFolder(): string {
  if (
    process.env.MIGRATIONS_FOLDER !== undefined &&
    process.env.MIGRATIONS_FOLDER.trim().length > 0
  ) {
    return process.env.MIGRATIONS_FOLDER.trim();
  }

  return resolve(process.cwd(), "drizzle");
}

function ensureMigrated(resolvedPath: string): void {
  if (migratedPaths.has(resolvedPath)) {
    return;
  }

  let sqlite: Database.Database | undefined;

  try {
    mkdirSync(dirname(resolvedPath), { recursive: true });
    sqlite = new Database(resolvedPath);
    // Some table-rebuild migrations need FK checks disabled during the migration transaction.
    sqlite.pragma("foreign_keys = OFF");
    migrate(drizzle(sqlite, { schema }), { migrationsFolder: resolveMigrationsFolder() });
    sqlite.pragma("foreign_keys = ON");
  } catch (error) {
    throw new DatabaseError("Failed to prepare the database.", { cause: error });
  } finally {
    sqlite?.close();
  }

  migratedPaths.add(resolvedPath);
}

function openDb(resolvedPath: string): SharedDatabase {
  ensureMigrated(resolvedPath);

  let sqlite: Database.Database | undefined;

  try {
    sqlite = new Database(resolvedPath);
    sqlite.pragma("foreign_keys = ON");

    return { sqlite, db: drizzle(sqlite, { schema }) };
  } catch (error) {
    sqlite?.close();
    throw new DatabaseError("Failed to open the database.", { cause: error });
  }
}

export function createDb(databasePath?: string): DrizzleDb {
  return openDb(resolveDatabasePath(databasePath)).db;
}

/** Local runtime connection shared by every repository for one database path. */
export function getSharedDb(databasePath?: string): DrizzleDb {
  const resolvedPath = resolveDatabasePath(databasePath);
  const databases = getSharedDatabases();
  const existing = databases.get(resolvedPath);
  if (existing) {
    return existing.db;
  }

  const opened = openDb(resolvedPath);
  databases.set(resolvedPath, opened);
  return opened.db;
}

/** Primarily used by tests and process shutdown paths. */
export function closeSharedDb(databasePath?: string): void {
  const databases = getSharedDatabases();

  if (databasePath !== undefined) {
    const resolvedPath = resolveDatabasePath(databasePath);
    // A throwing close() must not leave a stale entry pointing at a dead handle.
    try {
      databases.get(resolvedPath)?.sqlite.close();
    } finally {
      databases.delete(resolvedPath);
    }
    return;
  }

  try {
    for (const database of databases.values()) {
      database.sqlite.close();
    }
  } finally {
    databases.clear();
  }
}
