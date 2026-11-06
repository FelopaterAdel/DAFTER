import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { getAuthenticatedSetting } from "@/lib/auth/dal";
import { databaseFilePath } from "@/lib/backup/paths";
import { todayISO } from "@/lib/dates";

const NOT_AUTHORIZED = { error: "مش مسموح. سجّل الدخول الأول." };

export async function GET() {
  const setting = await getAuthenticatedSetting();
  if (!setting) {
    return Response.json(NOT_AUTHORIZED, { status: 401 });
  }

  const sourcePath = databaseFilePath();
  const tempPath = path.join(
    os.tmpdir(),
    `daftar-backup-${randomUUID()}.db`,
  );

  try {
    const source = new Database(sourcePath, {
      readonly: true,
      fileMustExist: true,
    });

    try {
      // SQLite's online backup API produces a consistent snapshot even while
      // the app is reading or writing.
      await source.backup(tempPath);
    } finally {
      source.close();
    }

    const bytes = await readFile(tempPath);
    const filename = `daftar-backup-${todayISO()}.db`;

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Backup failed:", error);
    return Response.json(
      { error: "تعذر إنشاء نسخة احتياطية. جرّب تاني." },
      { status: 500 },
    );
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}
