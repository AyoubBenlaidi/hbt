"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, Input, Button, Label } from "@/components/ui";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword, loading } = useAuth();
  const [status, setStatus] = useState<Status>("checking");
  const [token, setToken] = useState("");
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    // The emailed link goes through /api/auth/reset-password/:token, which
    // redirects here with ?token=… or, for an invalid or expired link, ?error=INVALID_TOKEN
    const params = new URLSearchParams(window.location.search);
    const linkToken = params.get("token");
    if (params.get("error") || !linkToken) {
      setLinkError("This reset link is invalid or has expired.");
      setStatus("invalid");
      return;
    }
    setToken(linkToken);
    setStatus("ready");
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

    const result = await updatePassword(token, password);
    if (!result.success) {
      setFormError(result.error || "Failed to update password");
      return;
    }

    setStatus("done");
    setTimeout(() => router.push("/login?message=Password updated. Please sign in."), 1500);
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
        <p className="text-center text-gray-600">Redirecting you to sign in...</p>
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
