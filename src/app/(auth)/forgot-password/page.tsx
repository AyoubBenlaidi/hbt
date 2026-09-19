"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Card, Input, Button, Label } from "@/components/ui";

export default function ForgotPasswordPage() {
  const { resetPassword, loading } = useAuth();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const [sent, setSent] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email");
      return;
    }

    const result = await resetPassword(email);
    if (!result.success) {
      setError(result.error || "Failed to send reset email");
      return;
    }

    // Show the same confirmation whether or not the email is registered,
    // so this form can't be used to probe which addresses have accounts.
    setSent(true);
  };

  if (sent) {
    return (
      <Card>
        <h1 className="text-2xl font-bold mb-4 text-center">Check your email</h1>
        <p className="text-center text-gray-600">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to
          reset your password.
        </p>
        <p className="text-center text-sm text-gray-600 mt-6">
          <Link href="/login" className="text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-2 text-center">Forgot password?</h1>
      <p className="text-center text-gray-600 mb-6 text-sm">
        Enter your email and we&apos;ll send you a link to reset it.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-4">
        <Link href="/login" className="text-blue-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
