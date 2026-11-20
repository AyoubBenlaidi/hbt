import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { isBcryptHash } from "@/lib/auth";

/**
 * Imports Supabase Auth accounts (auth.users) as Better Auth credential
 * accounts, keeping user ids and bcrypt password hashes: users sign in with
 * their current password. Run after the public tables were copied.
 * Idempotent: an account that already exists is left untouched.
 */

export interface SupabaseAuthUser {
  id: string;
  email: string;
  encrypted_password: string | null;
  email_confirmed_at: string | null;
}

export interface ImportReport {
  imported: string[];
  alreadyImported: string[];
  /** auth.users rows without a public.users row (nothing to attach the account to) */
  missingUser: string[];
  /** OAuth-only or invited accounts: no password to import */
  withoutPassword: string[];
  /** users.email updated to the sign-in email of auth.users */
  emailUpdated: string[];
}

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function importSupabaseAuthUsers(db: Db, authUsers: SupabaseAuthUser[]): Promise<ImportReport> {
  const report: ImportReport = {
    imported: [],
    alreadyImported: [],
    missingUser: [],
    withoutPassword: [],
    emailUpdated: [],
  };
  if (authUsers.length === 0) return report;

  const appUsers = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(inArray(schema.users.id, authUsers.map((u) => u.id)));
  const appUserById = new Map(appUsers.map((u) => [u.id, u]));

  for (const authUser of authUsers) {
    const appUser = appUserById.get(authUser.id);
    if (!appUser) {
      report.missingUser.push(authUser.id);
      continue;
    }

    const hash = authUser.encrypted_password;
    if (!hash || !isBcryptHash(hash)) {
      report.withoutPassword.push(authUser.id);
      continue;
    }

    // No transaction (the Neon HTTP driver has none): both writes are idempotent
    // Better Auth finds the user by users.email: it must be the sign-in email
    const email = authUser.email.toLowerCase();
    if (appUser.email !== email) {
      report.emailUpdated.push(authUser.id);
    }
    await db
      .update(schema.users)
      .set({ email, emailVerified: authUser.email_confirmed_at !== null })
      .where(eq(schema.users.id, authUser.id));

    const inserted = await db
      .insert(schema.accounts)
      .values({
        id: randomUUID(),
        userId: authUser.id,
        accountId: authUser.id,
        providerId: "credential",
        password: hash,
      })
      .onConflictDoNothing({ target: [schema.accounts.providerId, schema.accounts.accountId] })
      .returning({ id: schema.accounts.id });

    (inserted.length > 0 ? report.imported : report.alreadyImported).push(authUser.id);
  }

  return report;
}
