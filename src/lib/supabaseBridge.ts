import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";

/**
 * Supabase → Better Auth session bridge (migration period).
 *
 * People still signed in with Supabase have its session in localStorage. The
 * browser sends those tokens once; they are checked with Supabase Auth, and
 * the matching user (same id, imported) gets a Better Auth session cookie.
 * Nobody has to sign in again after the switch.
 */

export interface SupabaseTokens {
  accessToken: string;
  refreshToken?: string;
}

/** Returns the Supabase user id the tokens belong to, or null */
export type ResolveSupabaseUser = (tokens: SupabaseTokens) => Promise<{ id: string } | null>;

export function supabaseSessionBridge(resolve: ResolveSupabaseUser) {
  return {
    id: "supabase-session-bridge",
    endpoints: {
      supabaseSessionBridge: createAuthEndpoint("/supabase-bridge", { method: "POST" }, async (ctx) => {
        const { accessToken, refreshToken } = (ctx.body ?? {}) as Partial<SupabaseTokens>;
        if (typeof accessToken !== "string" || accessToken.length === 0) {
          throw new APIError("BAD_REQUEST", { message: "Missing Supabase access token" });
        }

        const resolved = await resolve({
          accessToken,
          refreshToken: typeof refreshToken === "string" ? refreshToken : undefined,
        });
        const user = resolved ? await ctx.context.internalAdapter.findUserById(resolved.id) : null;
        if (!user) {
          throw new APIError("UNAUTHORIZED", { message: "Invalid Supabase session" });
        }

        const session = await ctx.context.internalAdapter.createSession(user.id);
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ user: { id: user.id, email: user.email } });
      }),
    },
  } satisfies BetterAuthPlugin;
}

/** Checks the tokens with Supabase Auth (GoTrue), refreshing an expired access token */
export function supabaseUserResolver({
  url,
  apiKey,
  fetchFn = fetch,
}: {
  url: string;
  apiKey: string;
  fetchFn?: typeof fetch;
}): ResolveSupabaseUser {
  const getUser = async (accessToken: string): Promise<{ id: string } | null> => {
    const response = await fetchFn(`${url}/auth/v1/user`, {
      headers: { apikey: apiKey, Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string };
    return user.id ? { id: user.id } : null;
  };

  return async ({ accessToken, refreshToken }) => {
    const user = await getUser(accessToken);
    if (user || !refreshToken) return user;

    const response = await fetchFn(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const refreshed = (await response.json()) as { access_token?: string };
    return refreshed.access_token ? getUser(refreshed.access_token) : null;
  };
}
