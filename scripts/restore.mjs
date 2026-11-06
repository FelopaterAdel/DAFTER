#!/usr/bin/env node

/**
 * Offline restore fallback.
 *
 * Use this only when the app is stopped and the Settings restore screen is not
 * available. The web restore route is the normal path.
 *
 *   node scripts/restore.mjs prisma/backups/daftar-2026-11-06.db
 */

import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const SQLITE_HEADER = "SQLite format 3\u0000";
const REQUIRED_TABLES = [
  "Setting",
  "Custody",
  "CustodyItem",
  "Customer",
  "Charge",
  "Payment",
  "Product",
  "StockMovement",
  "_prisma_migrations",
];

function databasePath() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:")) {
    throw new Error("DATABASE_URL must start with file:");
  }

  const raw = url.slice("file:".length);
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function timestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function validate(filePath) {
  const header = readFileSync(filePath).subarray(0, 16).toString("binary");
  if (header !== SQLITE_HEADER) {
    throw new Error("The file is not a SQLite database.");
  }

  const source = new Database(filePath, { readonly: true, fileMustExist: true });

  try {
    const integrity = source.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") {
      throw new Error(`integrity_check failed: ${integrity}`);
    }

    const tables = new Set(
      source
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name),
    );

    for (const table of REQUIRED_TABLES) {
      if (!tables.has(table)) throw new Error(`Missing table: ${table}`);
    }

    const columns = source
      .prepare("PRAGMA table_info(Setting)")
      .all()
      .map((row) => row.name);

    if (!columns.includes("sessionVersion")) {
      throw new Error("Incompatible backup: run the Phase 2 migration first.");
    }

    const setting = source
      .prepare("SELECT id, pinHash FROM Setting WHERE id = 1")
      .get();

    if (!setting?.pinHash) throw new Error("Missing Setting row.");
  } finally {
    source.close();
  }
}

const backupArg = process.argv[2];
if (!backupArg) {
  console.error("Usage: node scripts/restore.mjs <backup.db>");
  process.exit(1);
}

const backupPath = path.resolve(process.cwd(), backupArg);
const livePath = databasePath();
const safetyPath = path.join(
  path.dirname(livePath),
  "backups",
  `pre-restore-${timestamp()}.db`,
);

validate(backupPath);

const current = new Database(livePath, { readonly: true, fileMustExist: true });
let currentVersion = 1;
try {
  currentVersion =
    current.prepare("SELECT sessionVersion FROM Setting WHERE id = 1").get()
      ?.sessionVersion ?? 1;
} finally {
  current.close();
}

mkdirSync(path.dirname(safetyPath), { recursive: true });
copyFileSync(livePath, safetyPath);

for (const suffix of ["-wal", "-shm", "-journal"]) {
  rmSync(`${livePath}${suffix}`, { force: true });
}

copyFileSync(backupPath, livePath);

const restored = new Database(livePath);
try {
  const restoredVersion =
    restored.prepare("SELECT sessionVersion FROM Setting WHERE id = 1").get()
      ?.sessionVersion ?? 1;

  restored
    .prepare("UPDATE Setting SET sessionVersion = ? WHERE id = 1")
    .run(Math.max(Number(restoredVersion), Number(currentVersion)) + 1);
  restored.pragma("journal_mode = delete");
} finally {
  restored.close();
}

console.log(`Restored: ${backupPath}`);
console.log(`Safety copy: ${safetyPath}`);
console.log("Restart the app, then sign in with the restored PIN.");
