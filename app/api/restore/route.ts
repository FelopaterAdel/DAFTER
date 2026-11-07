import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getAuthenticatedSetting } from "@/lib/auth/dal";
import { destroySession } from "@/lib/auth/session";
import { backupsDirectory, databaseFilePath } from "@/lib/backup/paths";
import { db } from "@/lib/db";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
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

let restoreInFlight = false;

function localTimestamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

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

async function removeSidecars(databasePath: string) {
  await Promise.all(
    ["-wal", "-shm", "-journal"].map((suffix) =>
      rm(`${databasePath}${suffix}`, { force: true }).catch(() => undefined),
    ),
  );
}

async function pruneSafetyCopies(directory: string, keep: number) {
  const entries = await readdir(directory);
  const safetyCopies = entries
    .filter((name) => name.startsWith("pre-restore-") && name.endsWith(".db"))
    .sort()
    .reverse();

  await Promise.all(
    safetyCopies.slice(keep).map((name) => rm(path.join(directory, name), { force: true })),
  );
}

async function getSqliteDatabase() {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  return require("better-sqlite3") as typeof import("better-sqlite3");
}

async function validateBackup(filePath: string) {
  const Database = await getSqliteDatabase();
  const source = new Database(filePath, {
    readonly: true,
    fileMustExist: true,
  });

  try {
    const integrity = source.pragma("integrity_check", { simple: true }) as string;
    if (integrity !== "ok") {
      throw new Error("integrity_check failed");
    }

    const tables = new Set(
      source
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row: unknown) => (row as { name: string }).name),
    );

    for (const table of REQUIRED_TABLES) {
      if (!tables.has(table)) {
        throw new Error(`Missing table: ${table}`);
      }
    }

    const settingColumns = source
      .prepare("PRAGMA table_info(Setting)")
      .all()
      .map((row: unknown) => (row as { name: string }).name);

    if (!settingColumns.includes("sessionVersion")) {
      throw new Error("Incompatible schema: Setting.sessionVersion is missing");
    }

    const setting = source
      .prepare("SELECT id, pinHash FROM Setting WHERE id = 1")
      .get() as { id: number; pinHash: string } | undefined;

    if (!setting || !setting.pinHash) {
      throw new Error("Missing Setting row");
    }
  } finally {
    source.close();
  }
}

export async function POST(request: Request) {
  const setting = await getAuthenticatedSetting();
  if (!setting) {
    return Response.json(
      { error: "مش مسموح. سجّل الدخول الأول." },
      { status: 401 },
    );
  }

  if (process.env.VERCEL) {
    return Response.json(
      {
        error:
          "استعادة النسخ الاحتياطية تعمل فقط على SQLite المحلي. استخدم PostgreSQL في Vercel.",
      },
      { status: 501 },
    );
  }

  if (restoreInFlight) {
    return Response.json(
      { error: "فيه عملية استرجاع شغالة بالفعل. استنى شوية." },
      { status: 409 },
    );
  }

  restoreInFlight = true;

  const tempPath = path.join(
    os.tmpdir(),
    `daftar-restore-${randomUUID()}.db`,
  );

  try {
    const formData = await request.formData();
    const upload = formData.get("file");

    if (!(upload instanceof File)) {
      return Response.json(
        { error: "اختار ملف نسخة احتياطية." },
        { status: 400 },
      );
    }

    if (upload.size <= 0) {
      return Response.json(
        { error: "الملف فاضي." },
        { status: 400 },
      );
    }

    if (upload.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        { error: "حجم الملف أكبر من الحد المسموح (50 ميجابايت)." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await upload.arrayBuffer());

    if (bytes.subarray(0, SQLITE_HEADER.length).toString("binary") !== SQLITE_HEADER) {
      return Response.json(
        { error: "الملف ده مش قاعدة بيانات SQLite صالحة." },
        { status: 400 },
      );
    }

    await writeFile(tempPath, bytes);

    try {
      await validateBackup(tempPath);
    } catch (error) {
      console.error("Restore validation failed:", error);
      return Response.json(
        {
          error:
            "النسخة دي مش متوافقة أو فيها مشكلة. اتأكد إنها نسخة دفتر سليمة وحديثة.",
        },
        { status: 400 },
      );
    }

    const livePath = databaseFilePath();
    const backupDirectory = backupsDirectory();
    const safetyPath = path.join(
      backupDirectory,
      `pre-restore-${localTimestamp()}.db`,
    );

    await mkdir(backupDirectory, { recursive: true });
    await copyFile(livePath, safetyPath);

    let swapped = false;

    try {
      await db.$disconnect();
      await removeSidecars(livePath);
      await copyFile(tempPath, livePath);
      swapped = true;

      const Database = await getSqliteDatabase();
      const restored = new Database(livePath);
      try {
        const restoredSetting = restored
          .prepare("SELECT sessionVersion FROM Setting WHERE id = 1")
          .get() as { sessionVersion: number } | undefined;
        const nextVersion =
          Math.max(
            Number(restoredSetting?.sessionVersion ?? 1),
            setting.sessionVersion,
          ) + 1;

        await db.$executeRawUnsafe(
          `UPDATE "Setting" SET "sessionVersion" = ${nextVersion} WHERE id = 1`,
        );
      } finally {
        restored.close();
      }

      await destroySession();

      return Response.json({ ok: true, restored: true });
    } catch (error) {
      console.error("Restore failed:", error);
      if (swapped) {
        await copyFile(safetyPath, livePath).catch(() => undefined);
      }
      return Response.json(
        { error: "تعذر استرجاع النسخة الاحتياطية. تم الاحتفاظ بالنسخة الحالية." },
        { status: 500 },
      );
    } finally {
      await pruneSafetyCopies(backupDirectory, 10).catch(() => undefined);
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  } finally {
    restoreInFlight = false;
  }
}
