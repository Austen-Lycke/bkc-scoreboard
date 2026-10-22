import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "@/lib/db";

/**
 * The app's own URL, for cookies and origin checks. Locally from BETTER_AUTH_URL; on Vercel the
 * production domain (or the deployment URL for previews), so no per-environment setting is needed.
 */
function baseURL(): string | undefined {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return undefined;
}

function createAuth() {
  return betterAuth({
    baseURL: baseURL(),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    // Logins are created by an admin (scripts/create-admin.ts), never by public sign-up.
    emailAndPassword: { enabled: true, disableSignUp: true },
    session: {
      // A competition day is long and the venue may be offline: keep operators signed in.
      expiresIn: 60 * 60 * 24 * 30,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "operator", input: false },
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

/** Lazy, so importing auth doesn't require DATABASE_URL at build time. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}

/**
 * "owner" (hoofdbeheerder) can do everything, including managing accounts; "admin" (beheerder)
 * everything except accounts; "operator" (wedstrijdleiding) runs competitions.
 */
export type Role = "owner" | "admin" | "operator";

/** Whether a user's role is one of `roles`. An owner passes every check an admin passes. */
export function hasRole(role: string | null | undefined, ...roles: Role[]) {
  return roles.includes(role as Role) || (role === "owner" && roles.includes("admin"));
}
