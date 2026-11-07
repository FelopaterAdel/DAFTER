#!/usr/bin/env node
/**
 * Scheduled SQLite backup for Daftar.
 *
 *   node scripts/backup.mjs [--out <dir>] [--keep <days>]
 *
 * Uses SQLite's online backup API, so it is safe to run while the app is
 * serving requests. Output: <project>/backups/daftar-YYYY-MM-DD.db
 * (overwrites today's file if it already exists). Backups older than
 * --keep days (default 14) are deleted.
 *
 * Cron example (02:15 every night):
 *   15 2 * * * cd /srv/daftar && node scripts/backup.mjs >> backups/backup.log 2>&1
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function flag(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  return index !== -1 && argv[index + 1] ? argv[index + 1] : fallback;
}

const KEEP_DAYS = Number(flag("keep", "14"));
const OUT_DIR = path.resolve(root, flag("out", "backups"));

/** Same behaviour as lib/backup/paths.ts, without the `server-only` import. */
function databaseFilePath() {
  let url = process.env.DATABASE_URL;

  if (!url && existsSync(path.join(root, ".env"))) {
    for (const line of readFileSync(path.join(root, ".env"), "utf8").split("\n")) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] ??= value;
    }
    url = process.env.DATABASE_URL;
  }

  const raw = (url ?? "file:./prisma/dev.db").replace(/^file:/, "");
  return path.isAbsolute(raw) ? raw : path.join(root, raw);
}

function today() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pruneOldBackups(directory, keepDays) {
  const cutoff = Date.now() - keepDays * 86_400_000;

  for (const name of readdirSafe(directory)) {
    if (!/^daftar-\d{4}-\d{2}-\d{2}\.db$/.test(name)) continue;

    const file = path.join(directory, name);
    if (statSync(file).mtimeMs < cutoff) {
      rmSync(file, { force: true });
      console.log(`pruned  ${name}`);
    }
  }
}

function readdirSafe(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}

async function main() {
  const source = databaseFilePath();

  if (!existsSync(source)) {
    console.error(`backup failed: database not found at ${source}`);
    process.exit(1);
  }

  const target = path.join(OUT_DIR, `daftar-${today()}.db`);
  const temp = `${target}.tmp`;

  const db = new Database(source, { readonly: true, fileMustExist: true });

  try {
    // Online backup = a consistent snapshot even while the app is writing.
    await db.backup(temp);
  } finally {
    db.close();
  }

  // Verify before publishing the file: a corrupt backup is worse than none.
  const check = new Database(temp, { readonly: true, fileMustExist: true });
  try {
    const integrity = check.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") throw new Error(`integrity_check: ${integrity}`);
  } finally {
    check.close();
  }

  // Rename inside the same directory so the published file is never partial.
  renameSync(temp, target);

  pruneOldBackups(OUT_DIR, KEEP_DAYS);

  console.log(`backup   ${target} (${statSync(target).size} bytes)`);
}

mkdirSync(OUT_DIR, { recursive: true });

main().catch((error) => {
  console.error("backup failed:", error);
  process.exit(1);
});
