"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, Input, Button, Label } from "@/components/ui";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword, loading } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    // Supabase appends #error=...&error_description=... to the redirect
    // when the recovery link itself is invalid or has expired.
    const hash = window.location.hash;
    if (hash.includes("error=")) {
      const params = new URLSearchParams(hash.substring(1));
      setLinkError(
        params.get("error_description")?.replace(/\+/g, " ") ||
          "This reset link is invalid or has expired."
      );
      setStatus("invalid");
      return;
    }

    // A valid recovery link makes supabase-js parse the #access_token in the
    // URL and emit this event once the recovery session is established.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    // getSession() awaits that same parsing internally, so it also resolves
    // once the recovery session (if any) is ready.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("ready");
      } else {
        setLinkError("This reset link is invalid or has expired.");
        setStatus((current) => (current === "checking" ? "invalid" : current));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setFormError("Passwords do not match");
      return;
    }

    const result = await updatePassword(password);
    if (!result.success) {
      setFormError(result.error || "Failed to update password");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/households"), 1500);
  };

  if (status === "checking") {
    return (
      <Card>
        <p className="text-center text-gray-600">Verifying your link...</p>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card>
        <h1 className="text-2xl font-bold mb-4 text-center">Link expired</h1>
        <p className="text-center text-gray-600 mb-6">{linkError}</p>
        <Link href="/forgot-password">
          <Button className="w-full">Request a new link</Button>
        </Link>
      </Card>
    );
  }

  if (status === "done") {
    return (
      <Card>
        <h1 className="text-2xl font-bold mb-4 text-center">Password updated</h1>
        <p className="text-center text-gray-600">Redirecting you...</p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-6 text-center">Set a new password</h1>

      {formError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Updating..." : "Update password"}
        </Button>
      </form>
    </Card>
  );
}
