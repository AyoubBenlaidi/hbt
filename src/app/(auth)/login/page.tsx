"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, Input, Button, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, loading, error: authError, isAuthenticated } = useAuth();
  const [error, setError] = React.useState<string>("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [next, setNext] = React.useState("/households");

  // ?message=… from signup/reset, ?next=… from the middleware redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMessage(params.get("message") || "");
    const target = params.get("next");
    // Same-origin paths only
    if (target && target.startsWith("/") && !target.startsWith("//")) {
      setNext(target);
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(next);
    }
  }, [isAuthenticated, router, next]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    const result = await signIn(email, password);
    if (result.success) {
      router.push(next);
    } else {
      setError(result.error || "Failed to sign in");
    }
  };

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>

      {message && !(error || authError) && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {message}
        </div>
      )}

      {(error || authError) && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error || authError}
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

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline mb-1">
              Forgot password?
            </Link>
          </div>
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

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600 mt-4">
        Don't have an account?{" "}
        <Link href="/signup" className="text-blue-600 hover:underline">
          Sign up
        </Link>
      </p>
    </Card>
  );
}
