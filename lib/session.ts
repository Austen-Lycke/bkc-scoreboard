import "server-only";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { getAuth, hasRole, type Role } from "@/lib/auth";

export async function getSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

/**
 * For pages/actions: signed in with one of the given roles, otherwise login / 403.
 * Every page calls this itself: a check in a layout doesn't stop the page from rendering, and its
 * data would still be sent along with the redirect.
 */
export async function requireRole(...roles: Role[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasRole(session.user.role, ...roles)) forbidden();
  return session;
}
