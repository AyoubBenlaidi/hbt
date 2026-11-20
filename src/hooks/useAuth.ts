"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

type Result = { success: true } | { success: false; error: string };

export function useAuth() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>("");

  const user: AuthUser | null = session
    ? { id: session.user.id, email: session.user.email, name: session.user.name }
    : null;

  // Runs an auth call, exposing its pending state and error message
  const run = async (call: () => Promise<{ error: { message?: string } | null }>, fallback: string): Promise<Result> => {
    setError("");
    setPending(true);
    try {
      const { error: authError } = await call();
      if (authError) {
        const message = authError.message || fallback;
        setError(message);
        return { success: false, error: message };
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : fallback;
      setError(message);
      return { success: false, error: message };
    } finally {
      setPending(false);
    }
  };

  const signUp = (email: string, password: string, displayName: string) =>
    run(() => authClient.signUp.email({ email, password, name: displayName }), "Failed to sign up");

  const signIn = (email: string, password: string) =>
    run(() => authClient.signIn.email({ email, password }), "Failed to sign in");

  const signOut = async () => {
    const result = await run(() => authClient.signOut(), "Failed to sign out");
    if (result.success) {
      router.push("/login");
    }
    return result;
  };

  /** Emails a reset link pointing to /reset-password?token=… */
  const resetPassword = (email: string) =>
    run(
      () => authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }),
      "Failed to send reset email"
    );

  /** Sets a new password with the token from the reset link */
  const updatePassword = (token: string, newPassword: string) =>
    run(() => authClient.resetPassword({ token, newPassword }), "Failed to update password");

  return {
    user,
    loading: isPending || pending,
    error,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    isAuthenticated: !!user,
  };
}
