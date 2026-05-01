"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@clerk/nextjs";

export default function ResetPasswordPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("No session found. Please sign in again.");

      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword: password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Failed to update password. Please try again.");
      }

      // Hard navigate so Clerk session refreshes with updated metadata
      window.location.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isLoaded) return null;
  if (!isSignedIn) {
    window.location.replace("/");
    return null;
  }

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden flex flex-col items-center justify-center px-5"
      style={{ fontFamily: "var(--font-body)", background: "#f8fcfb" }}
    >
      <div
        className="rounded-[24px] px-8 py-10 sm:p-12 w-full"
        style={{
          maxWidth: "440px",
          background: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          boxShadow: "0 32px 64px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div className="text-center mb-8">
          <h1
            className="text-[24px] font-bold text-black mb-2 leading-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Update Your Password
          </h1>
          <p className="text-[14px] leading-relaxed text-black/70">
            For security reasons, you must set a new password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.6px] text-zinc-500 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full py-[14px] px-4 bg-white border border-zinc-200 rounded-xl text-[15px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[#006d6c]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.6px] text-zinc-500 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              className="w-full py-[14px] px-4 bg-white border border-zinc-200 rounded-xl text-[15px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[#006d6c]"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-400/50 bg-red-50 px-4 py-3 text-[14px] leading-relaxed text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[48px] rounded-xl text-white font-bold text-base cursor-pointer border-none transition-all mt-4 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)",
              boxShadow: "0 8px 16px rgba(10, 190, 98, 0.22)",
              fontFamily: "var(--font-heading)",
            }}
          >
            {isSubmitting ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
