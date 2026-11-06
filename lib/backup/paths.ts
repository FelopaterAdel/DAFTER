import "server-only";

import path from "node:path";

/**
 * Resolves the SQLite file behind `DATABASE_URL`.
 *
 * Prisma uses URLs like `file:./prisma/dev.db`; in production the path is
 * usually absolute (`file:/data/daftar.db`).
 */
export function databaseFilePath() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

  if (!url.startsWith("file:")) {
    throw new Error("DATABASE_URL must use the SQLite file: scheme.");
  }

  const rawPath = url.slice("file:".length);

  // DATABASE_URL is runtime configuration, so the path cannot be statically
  // known. Opt out of Turbopack tracing; otherwise it bundles the whole
  // project as if any file could be the database.
  return path.isAbsolute(rawPath)
    ? rawPath
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath);
}

export function backupsDirectory() {
  return path.join(path.dirname(databaseFilePath()), "backups");
}
