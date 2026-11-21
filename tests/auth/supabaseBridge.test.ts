import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createAuth, type Auth } from "@/lib/auth";
import { supabaseUserResolver } from "@/lib/supabaseBridge";
import { createTestDb, type TestDb } from "../helpers/db";
import { createUser } from "../helpers/factories";

/**
 * Supabase sessions left in the browser become Better Auth sessions:
 * people stay signed in across the switch.
 */

let db: TestDb;
let client: PGlite;
let auth: Auth;
const validTokens = new Map<string, string>(); // access token → Supabase user id

beforeAll(async () => {
  ({ db, client } = await createTestDb());
  auth = createAuth({
    db,
    baseURL: "http://localhost:3000",
    secret: "test-secret-test-secret-test-secret-123",
    sendEmail: async () => {},
    resolveSupabaseUser: async ({ accessToken }) => {
      const id = validTokens.get(accessToken);
      return id ? { id } : null;
    },
  });
});
afterAll(async () => {
  await client.close();
});

const bridge = (body: unknown) =>
  auth.handler(
    new Request("http://localhost:3000/api/auth/supabase-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify(body),
    })
  );

describe("session bridge endpoint", () => {
  it("turns a valid Supabase session into a Better Auth session for the same user", async () => {
    const user = await createUser(db);
    validTokens.set("token-1", user.id);

    const response = await bridge({ accessToken: "token-1", refreshToken: "r" });
    expect(response.status).toBe(200);

    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.id).toBe(user.id);
  });

  it("rejects an invalid token, a user that was not imported, and a missing token", async () => {
    validTokens.set("token-orphan", "99999999-9999-9999-9999-999999999999");
    expect((await bridge({ accessToken: "forged" })).status).toBe(401);
    expect((await bridge({ accessToken: "token-orphan" })).status).toBe(401);
    expect((await bridge({})).status).toBe(400);
  });
});

describe("supabaseUserResolver", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it("checks the access token with Supabase Auth", async () => {
    const fetchFn = vi.fn(async () => json(200, { id: "u1" }));
    const resolve = supabaseUserResolver({ url: "https://p.supabase.co", apiKey: "pk", fetchFn });
    expect(await resolve({ accessToken: "a" })).toEqual({ id: "u1" });
    expect(fetchFn).toHaveBeenCalledWith("https://p.supabase.co/auth/v1/user", {
      headers: { apikey: "pk", Authorization: "Bearer a" },
    });
  });

  it("refreshes an expired access token", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/token")) return json(200, { access_token: "fresh" });
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer fresh" ? json(200, { id: "u1" }) : json(401, {});
    });
    const resolve = supabaseUserResolver({ url: "https://p.supabase.co", apiKey: "pk", fetchFn: fetchFn as typeof fetch });
    expect(await resolve({ accessToken: "expired", refreshToken: "r" })).toEqual({ id: "u1" });
  });

  it("returns null when both tokens are rejected", async () => {
    const fetchFn = vi.fn(async () => json(401, {}));
    const resolve = supabaseUserResolver({ url: "https://p.supabase.co", apiKey: "pk", fetchFn });
    expect(await resolve({ accessToken: "x", refreshToken: "y" })).toBeNull();
    expect(await resolve({ accessToken: "x" })).toBeNull();
  });
});
