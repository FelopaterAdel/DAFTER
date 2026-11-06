import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getSetting } from "@/lib/settings";

import { hasValidSession } from "./session";

/**
 * Server-side guard for every private page and action.
 * Redirects to setup before first run, then to login when the session is missing.
 */
export const requireAuth = cache(async () => {
  // Every guard runs at request time. This must happen before reading the
  // clock (session expiry) or "today", so prerendering bails out cleanly.
  await connection();

  const setting = await getSetting();

  if (!setting) redirect("/setup");
  if (!(await hasValidSession(setting.sessionVersion))) redirect("/login");

  return setting;
});

/** For /login and /setup: sends an already-authenticated owner home. */
export const redirectIfAuthenticated = cache(async () => {
  await connection();

  const setting = await getSetting();
  if (!setting) return null;
  if (await hasValidSession(setting.sessionVersion)) redirect("/");

  return setting;
});

/**
 * Non-redirecting guard for route handlers (backup, export, restore).
 * Returns `null` instead of redirecting so callers can reply with `401`.
 */
export const getAuthenticatedSetting = cache(async () => {
  await connection();

  const setting = await getSetting();
  if (!setting) return null;
  if (!(await hasValidSession(setting.sessionVersion))) return null;

  return setting;
});
