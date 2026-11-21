import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "@/db/schema";
import { createAuth, isBcryptHash, type Auth } from "@/lib/auth";
import { importSupabaseAuthUsers } from "../../scripts/migration/importSupabaseAuth";
import { createTestDb, type TestDb } from "../helpers/db";
import { createUser } from "../helpers/factories";

/**
 * Better Auth on the app schema: sign-up, sign-in, sessions, password reset,
 * and accounts imported from Supabase Auth (bcrypt) keeping their password.
 */

let db: TestDb;
let client: PGlite;
let auth: Auth;
const sentEmails: { to: string; subject: string; text: string }[] = [];

beforeAll(async () => {
  ({ db, client } = await createTestDb());
  auth = createAuth({
    db,
    baseURL: "http://localhost:3000",
    secret: "test-secret-test-secret-test-secret-123",
    sendEmail: async (email) => {
      sentEmails.push(email);
    },
  });
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  sentEmails.length = 0;
});

let n = 0;
const newEmail = () => `person${++n}@example.com`;

async function signIn(email: string, password: string) {
  const { headers } = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
  const cookie = headers.get("set-cookie")!.split(";")[0];
  return new Headers({ cookie });
}

/** Supabase stores bcrypt hashes with the $2a$ prefix and cost 10 */
const supabaseHash = (password: string) => bcrypt.hashSync(password, 10).replace(/^\$2b\$/, "$2a$");

/** A Supabase account: public.users row (copied data) + auth.users entry */
async function supabaseUser(password: string, overrides: { email_confirmed_at?: string | null } = {}) {
  const user = await createUser(db, { email: newEmail(), displayName: "Marie" });
  const authUser = {
    id: user.id,
    email: user.email,
    encrypted_password: supabaseHash(password),
    email_confirmed_at: "2026-04-01T10:00:00Z",
    ...overrides,
  };
  return { user, authUser };
}

describe("sign-up", () => {
  it("creates the app user (uuid id, display name) with a scrypt password", async () => {
    const email = newEmail();
    const result = await auth.api.signUpEmail({ body: { email, password: "s3cret-pass", name: "Ayoub" } });

    expect(result.user.id).toMatch(/^[0-9a-f-]{36}$/);
    const [row] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    expect(row).toMatchObject({ id: result.user.id, displayName: "Ayoub", emailVerified: false });

    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, row.id));
    expect(account.providerId).toBe("credential");
    expect(isBcryptHash(account.password!)).toBe(false);
  });

  it("rejects an email already in use", async () => {
    const email = newEmail();
    await auth.api.signUpEmail({ body: { email, password: "s3cret-pass", name: "A" } });
    await expect(auth.api.signUpEmail({ body: { email, password: "other-pass", name: "B" } })).rejects.toThrow();
  });

  it("rejects a password shorter than 6 characters", async () => {
    await expect(
      auth.api.signUpEmail({ body: { email: newEmail(), password: "12345", name: "A" } })
    ).rejects.toThrow();
  });
});

describe("sign-in and session", () => {
  it("signs in, exposes the session, then signs out", async () => {
    const email = newEmail();
    await auth.api.signUpEmail({ body: { email, password: "s3cret-pass", name: "Ayoub" } });

    const headers = await signIn(email, "s3cret-pass");
    const session = await auth.api.getSession({ headers });
    expect(session?.user).toMatchObject({ email, name: "Ayoub" });

    await auth.api.signOut({ headers });
    expect(await auth.api.getSession({ headers })).toBeNull();
  });

  it("rejects a wrong password and an unknown email", async () => {
    const email = newEmail();
    await auth.api.signUpEmail({ body: { email, password: "s3cret-pass", name: "A" } });
    await expect(signIn(email, "wrong-pass")).rejects.toThrow();
    await expect(signIn(newEmail(), "s3cret-pass")).rejects.toThrow();
  });
});

describe("accounts imported from Supabase Auth", () => {
  it("keep their id and current password (6 characters, Supabase minimum)", async () => {
    const { user, authUser } = await supabaseUser("abc123");
    const report = await importSupabaseAuthUsers(db, [authUser]);
    expect(report.imported).toEqual([user.id]);

    const headers = await signIn(user.email, "abc123");
    const session = await auth.api.getSession({ headers });
    expect(session?.user.id).toBe(user.id);
    expect(session?.user.emailVerified).toBe(true);
    await expect(signIn(user.email, "abc124")).rejects.toThrow();
  });

  it("import is idempotent and never overwrites a password changed since", async () => {
    const { user, authUser } = await supabaseUser("old-pass");
    await importSupabaseAuthUsers(db, [authUser]);
    await db
      .update(schema.accounts)
      .set({ password: "changed" })
      .where(eq(schema.accounts.userId, user.id));

    const report = await importSupabaseAuthUsers(db, [authUser]);
    expect(report.alreadyImported).toEqual([user.id]);
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, user.id));
    expect(account.password).toBe("changed");
  });

  it("reports auth users without an app user or without a password", async () => {
    const orphanId = "99999999-9999-9999-9999-999999999999";
    const { user } = await supabaseUser("whatever");
    const report = await importSupabaseAuthUsers(db, [
      { id: orphanId, email: "ghost@example.com", encrypted_password: supabaseHash("x"), email_confirmed_at: null },
      { id: user.id, email: user.email, encrypted_password: "", email_confirmed_at: null },
    ]);
    expect(report.missingUser).toEqual([orphanId]);
    expect(report.withoutPassword).toEqual([user.id]);
  });

  it("uses the sign-in email of auth.users and its confirmation state", async () => {
    const { user, authUser } = await supabaseUser("pass123", { email_confirmed_at: null });
    const signInEmail = `New.${user.email}`;
    const report = await importSupabaseAuthUsers(db, [{ ...authUser, email: signInEmail }]);
    expect(report.emailUpdated).toEqual([user.id]);

    const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
    expect(row).toMatchObject({ email: signInEmail.toLowerCase(), emailVerified: false });
    await signIn(signInEmail.toLowerCase(), "pass123");
  });
});

describe("password reset", () => {
  it("emails a link, sets the new password and revokes existing sessions", async () => {
    const { user, authUser } = await supabaseUser("old-pass");
    await importSupabaseAuthUsers(db, [authUser]);
    const oldSession = await signIn(user.email, "old-pass");

    await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo: "/reset-password" } });
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]).toMatchObject({ to: user.email, subject: "Réinitialisation de ton mot de passe" });

    const url = sentEmails[0].text.match(/http\S+/)![0];
    const token = new URL(url).pathname.split("/").pop()!;
    await auth.api.resetPassword({ body: { token, newPassword: "new-pass" } });

    expect(await auth.api.getSession({ headers: oldSession })).toBeNull();
    await expect(signIn(user.email, "old-pass")).rejects.toThrow();
    await signIn(user.email, "new-pass");

    // The legacy bcrypt hash was replaced by a scrypt one
    const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, user.id));
    expect(isBcryptHash(account.password!)).toBe(false);
  });

  it("does not reveal whether an email exists", async () => {
    await expect(
      auth.api.requestPasswordReset({ body: { email: "nobody@example.com", redirectTo: "/reset-password" } })
    ).resolves.toBeTruthy();
    expect(sentEmails).toHaveLength(0);
  });

  it("rejects an invalid token", async () => {
    await expect(auth.api.resetPassword({ body: { token: "nope", newPassword: "whatever1" } })).rejects.toThrow();
  });
});
