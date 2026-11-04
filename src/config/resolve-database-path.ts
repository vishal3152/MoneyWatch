import { join, resolve } from "node:path";

import { readDatabasePathFromSettings } from "@/config/database-settings";

export const defaultDatabasePath = join(process.cwd(), "money-watch.db");

// Precedence: explicit arg > DATABASE_PATH env > saved desktop setting >
// ./money-watch.db default. Never hardcode the DB path elsewhere — this is
// what lets users point data at a synced folder (Dropbox/iCloud).
export function resolveDatabasePath(explicitPath?: string): string {
  if (explicitPath !== undefined && explicitPath.trim().length > 0) {
    return resolve(explicitPath.trim());
  }

  const envPath = process.env.DATABASE_PATH;
  if (envPath !== undefined && envPath.trim().length > 0) {
    return resolve(envPath.trim());
  }

  const settingsPath = readDatabasePathFromSettings();
  if (settingsPath !== null) {
    return resolve(settingsPath);
  }

  return resolve(defaultDatabasePath);
}
