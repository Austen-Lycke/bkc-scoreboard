import "server-only";
import { getAuth, hasRole, type Role } from "@/lib/auth";

/** For route handlers: the session when the user has one of the roles, otherwise an error response. */
export async function sessionWithRole(request: Request, ...roles: Role[]) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return { error: Response.json({ error: "Niet aangemeld" }, { status: 401 }) } as const;
  if (!hasRole(session.user.role, ...roles)) {
    return { error: Response.json({ error: "Geen toegang" }, { status: 403 }) } as const;
  }
  return { session } as const;
}
