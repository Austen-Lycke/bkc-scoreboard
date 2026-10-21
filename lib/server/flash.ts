import "server-only";
import { cookies } from "next/headers";
import { FLASH_COOKIE } from "@/lib/flash";

/**
 * A one-time confirmation for the next admin page, e.g. "Jan Peeters is toegevoegd." after a
 * redirect. The admin layout shows it and the browser clears the cookie right away.
 */
export async function setFlash(message: string) {
  // The timestamp makes a repeated message show again.
  (await cookies()).set(FLASH_COOKIE, `${Date.now()}|${message}`, { path: "/admin", maxAge: 60, sameSite: "lax" });
}

export async function readFlash(): Promise<{ id: string; message: string } | null> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  const sep = raw?.indexOf("|") ?? -1;
  return raw && sep > 0 ? { id: raw, message: raw.slice(sep + 1) } : null;
}
