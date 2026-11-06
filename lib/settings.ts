import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";

/** The singleton settings row, or `null` before the first-run setup. */
export const getSetting = cache(async () => {
  return db.setting.findUnique({ where: { id: 1 } });
});
