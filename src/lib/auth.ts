import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hashPassword, verifyPassword as verifyScrypt } from "better-auth/crypto";
import { nextCookies } from "better-auth/next-js";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/services/email/mailer";
import { renderResetPasswordEmail } from "@/services/email/resetPasswordEmail";
import { supabaseSessionBridge, supabaseUserResolver, type ResolveSupabaseUser } from "@/lib/supabaseBridge";

/**
 * Authentication (Better Auth, self-hosted in this app)
 *
 * - The auth "user" model is the app's `users` table, so user ids are the ones
 *   every other table references (and the ones imported from Supabase Auth).
 * - Passwords: new ones are hashed with scrypt (Better Auth default); bcrypt
 *   hashes imported from Supabase Auth keep working.
 */

type Mailer = typeof sendEmail;

export interface CreateAuthOptions {
  // Any Drizzle Postgres database (node-postgres in the app, PGlite in tests)
  db: Parameters<typeof drizzleAdapter>[0];
  sendEmail: Mailer;
  baseURL?: string;
  secret?: string;
  trustedOrigins?: string[];
  /** Enables the Supabase session bridge (migration period) */
  resolveSupabaseUser?: ResolveSupabaseUser;
  // Next.js only (needs a request scope): see getAuth
  plugins?: ReturnType<typeof nextCookies>[];
}

/** Supabase Auth stores bcrypt hashes ($2a$10$…) */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash);
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
  return isBcryptHash(hash) ? bcrypt.compare(password, hash) : verifyScrypt({ hash, password });
}

export function createAuth({
  db,
  sendEmail,
  baseURL,
  secret,
  trustedOrigins,
  resolveSupabaseUser,
  plugins = [],
}: CreateAuthOptions) {
  return betterAuth({
    appName: "Home Budget Tracker",
    baseURL,
    secret,
    trustedOrigins,
    database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
    user: {
      fields: { name: "displayName" },
    },
    emailAndPassword: {
      enabled: true,
      // Supabase Auth's minimum: existing passwords must stay valid
      minPasswordLength: 6,
      password: { hash: hashPassword, verify: verifyPassword },
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({ to: user.email, ...renderResetPasswordEmail({ name: user.name, url }) });
      },
    },
    advanced: {
      database: { generateId: () => randomUUID() },
    },
    plugins: [...(resolveSupabaseUser ? [supabaseSessionBridge(resolveSupabaseUser)] : []), ...plugins],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let _auth: Auth | null = null;

/** App instance, created on first use (env vars are not available at build time) */
export function getAuth(): Auth {
  if (!_auth) {
    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    _auth = createAuth({
      db: getDb(),
      sendEmail,
      baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || vercelUrl,
      secret: process.env.BETTER_AUTH_SECRET,
      trustedOrigins: vercelUrl ? [vercelUrl] : [],
      resolveSupabaseUser:
        supabaseUrl && supabaseKey ? supabaseUserResolver({ url: supabaseUrl, apiKey: supabaseKey }) : undefined,
      // Lets server actions set auth cookies; must stay the last plugin
      plugins: [nextCookies()],
    });
  }
  return _auth;
}
