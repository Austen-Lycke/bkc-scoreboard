import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "@/lib/db";

function createAuth() {
  return betterAuth({
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

export type Role = "admin" | "operator";
