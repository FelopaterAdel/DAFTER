import "server-only";

import { cookies, headers } from "next/headers";

import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "./token";

export async function createSession(version = 1) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, createSessionToken(version), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

function readCookieValue(header: string | null, name: string) {
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;

    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return undefined;
}

/**
 * Reads and verifies the session cookie.
 *
 * In dev with Cache Components, Next.js re-renders a page after a server
 * action that returns form state while the request store is still marked as
 * being in the action phase. `cookies()` then hits an internal invariant
 * ("underlying cookies object does not match..."). Reading the same cookie
 * from the request headers avoids that instrumentation and is equivalent,
 * because the session cookie is only set on login/logout responses.
 */
export async function hasValidSession(expectedVersion?: number) {
  try {
    const cookieStore = await cookies();
    return verifySessionToken(
      cookieStore.get(SESSION_COOKIE)?.value,
      expectedVersion,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("underlying cookies object")) throw error;

    const cookieHeader = (await headers()).get("cookie");
    return verifySessionToken(
      readCookieValue(cookieHeader, SESSION_COOKIE),
      expectedVersion,
    );
  }
}
