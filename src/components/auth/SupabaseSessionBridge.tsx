"use client";

import { useEffect } from "react";

/**
 * Keeps people signed in across the Supabase → Better Auth switch.
 *
 * supabase-js left the session in localStorage (sb-<project>-auth-token).
 * When it is there, its tokens are exchanged once for a Better Auth session,
 * then the page reloads (to ?next when on /login). The Supabase entry is
 * removed in every case so the exchange is never retried.
 */

const SUPABASE_SESSION_KEY = /^sb-[a-z0-9]+-auth-token$/;

function takeSupabaseSession(): { accessToken: string; refreshToken?: string } | null {
  try {
    const key = Object.keys(window.localStorage).find((k) => SUPABASE_SESSION_KEY.test(k));
    if (!key) return null;
    const raw = window.localStorage.getItem(key);
    window.localStorage.removeItem(key);
    const stored = JSON.parse(raw || "null");
    // supabase-js v2 stores the session itself; older versions nested it
    const session = stored?.currentSession ?? stored;
    return session?.access_token
      ? { accessToken: session.access_token, refreshToken: session.refresh_token }
      : null;
  } catch {
    return null;
  }
}

function destinationAfterBridge(): string {
  const { pathname, search } = window.location;
  if (pathname !== "/login") return pathname + search;
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/households";
}

export function SupabaseSessionBridge() {
  useEffect(() => {
    const tokens = takeSupabaseSession();
    if (!tokens) return;

    fetch("/api/auth/supabase-bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokens),
      credentials: "same-origin",
    })
      .then((response) => {
        if (response.ok) window.location.replace(destinationAfterBridge());
      })
      .catch(() => {
        // The person signs in normally
      });
  }, []);

  return null;
}
