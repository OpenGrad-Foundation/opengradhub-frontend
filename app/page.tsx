"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { signIn, signUp } from "@/lib/api";
import {
  getStoredAuthToken,
  isClerkMode,
  persistAuthToken,
} from "@/lib/auth-session";

const roleOptions = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "PROGRAM_MANAGER", label: "Program Manager" },
  { value: "ZONAL_MANAGER", label: "Zonal Manager" },
  { value: "FELLOW", label: "Fellow" },
  { value: "STUDENT", label: "Student" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "FUNDING_PARTNER", label: "Funding Partner" },
];

type AuthMode = "sign-in" | "sign-up";

type SignInFormProps = {
  initialIdentifier: string;
  successMessage: string | null;
};

// ---------------------------------------------------------------------------
// Shared SVG icons — consistent 18px stroke-2 outline style
// ---------------------------------------------------------------------------

function EnvelopeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

// border-black/25 (~#bfbfbf) gives clear affordance without being heavy.
// White bg + zinc-200 border makes fields clearly visible on the white card.
// zinc-400 placeholder sits above the 3:1 UI-component threshold.
const inputClass =
  "w-full py-[14px] bg-white border border-zinc-200 rounded-xl text-[15px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[var(--teal)] focus:shadow-[0_0_0_3px_rgba(0,109,108,0.13)] hover:border-zinc-300";

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.6px] text-zinc-500 mb-2";

// Focus ring utility applied to all non-input interactive elements.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--teal)] focus-visible:ring-offset-1";

// ---------------------------------------------------------------------------
// Clerk sign-in form (used when NEXT_PUBLIC_AUTH_MODE=clerk)
// Auth logic is UNCHANGED — only the JSX is fixed.
// ---------------------------------------------------------------------------

function ClerkSignInForm({
  initialIdentifier,
  successMessage,
}: SignInFormProps) {
  // Clerk v7 "Future" signal API: { signIn, errors, fetchStatus }
  const { signIn } = useSignIn();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signIn) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // create() initiates sign-in; status updates on the resource reactively
      const { error: createError } = await signIn.create({ identifier, password });
      if (createError) {
        setError(createError.message ?? "Sign-in failed.");
        return;
      }

      if (signIn.status === "complete") {
        // finalize() sets the new session as active
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.message ?? "Could not activate session.");
          return;
        }
        // Hard navigation so middleware sees the new Clerk session cookie
        window.location.replace("/dashboard");
        return;
      }

      setError(
        `Sign-in requires additional steps (status: ${signIn.status}). Please contact an administrator.`,
      );
    } catch (err: unknown) {
      const clerkErrors = (err as { errors?: Array<{ message: string }> })?.errors;
      setError(clerkErrors?.[0]?.message ?? "We could not sign you in right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-5">
      {/* Identifier */}
      <div>
        <label htmlFor="clerk-identifier" className={labelClass}>
          Email or roll number
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
            <EnvelopeIcon />
          </span>
          <input
            id="clerk-identifier"
            name="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="name@opengrad.edu or OG-STU-001"
            className={`${inputClass} pl-11 pr-4`}
            autoComplete="email"
            required
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label htmlFor="clerk-password" className={labelClass}>
          Password
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
            <LockIcon />
          </span>
          <input
            id="clerk-password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`${inputClass} pl-11 pr-12`}
            autoComplete="current-password"
            required
          />
          {/* Eye toggle — 44×44px hit area */}
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className={`absolute right-0 top-0 h-full w-[44px] flex items-center justify-center text-zinc-400 hover:text-[var(--teal)] cursor-pointer transition-colors ${focusRing}`}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>

      {/* Success — role="status" so screen readers announce it politely */}
      {successMessage ? (
        <p
          role="status"
          className="rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/8 px-4 py-3 text-sm text-black/80"
        >
          {successMessage}
        </p>
      ) : null}

      {/* Error — role="alert" so screen readers announce immediately */}
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-400/50 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <SubmitButton isSubmitting={isSubmitting} label="Sign In to Platform" loadingLabel="Signing in…" />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared submit button — prevents duplication
// ---------------------------------------------------------------------------

function SubmitButton({
  isSubmitting,
  label,
  loadingLabel,
}: {
  isSubmitting: boolean;
  label: string;
  loadingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={isSubmitting}
      className={`w-full min-h-[48px] rounded-xl text-white font-bold text-base cursor-pointer border-none transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 mt-1 ${focusRing}`}
      style={{
        background: "linear-gradient(135deg, var(--green) 0%, var(--teal) 100%)",
        boxShadow: "0 8px 16px rgba(10, 190, 98, 0.22)",
        fontFamily: "var(--font-heading)",
      }}
    >
      {isSubmitting ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin"
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main login page
// All auth state, handlers, and logic below are UNCHANGED.
// Only the JSX return and visual layer is fixed.
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpForm, setSignUpForm] = useState({
    fullName: "",
    email: "",
    rollNumber: "",
    phone: "",
    programme: "",
    zone: "",
    schoolName: "",
    roleCode: "STUDENT",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isStudentSignUp = useMemo(
    () => signUpForm.roleCode === "STUDENT",
    [signUpForm.roleCode],
  );

  const clerkMode = isClerkMode();

  useEffect(() => {
    if (!clerkMode && getStoredAuthToken()) {
      router.replace("/dashboard");
    }
  }, [router, clerkMode]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await signIn({ identifier, password });
      persistAuthToken(response.accessToken);
      router.replace("/dashboard");
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "We could not sign you in right now.";

      if (
        typeof caughtError === "object" &&
        caughtError !== null &&
        "errors" in caughtError
      ) {
        const clerkErrors = (caughtError as { errors: Array<{ message: string }> }).errors;
        setError(clerkErrors[0]?.message ?? message);
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await signUp({
        fullName: signUpForm.fullName,
        email: isStudentSignUp ? undefined : signUpForm.email,
        rollNumber: isStudentSignUp ? signUpForm.rollNumber : undefined,
        phone: signUpForm.phone || undefined,
        programme: signUpForm.programme || undefined,
        zone: signUpForm.zone || undefined,
        schoolName: signUpForm.schoolName || undefined,
        roleCode: signUpForm.roleCode,
        password: signUpForm.password,
        confirmPassword: signUpForm.confirmPassword,
      });

      setIdentifier(isStudentSignUp ? signUpForm.rollNumber : signUpForm.email);
      setPassword("");
      setMode("sign-in");
      setSuccessMessage(
        "Account created. Sign in now with your email or roll number and password.",
      );
      setSignUpForm((s) => ({ ...s, password: "", confirmPassword: "" }));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not create this account right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateSignUpField(field: keyof typeof signUpForm, value: string) {
    setSignUpForm((s) => ({ ...s, [field]: value }));
  }

  // ---------------------------------------------------------------------------
  // Helpers for mode switching
  // ---------------------------------------------------------------------------

  function goToSignUp() {
    setMode("sign-up");
    setError(null);
    setSuccessMessage(null);
  }

  function goToSignIn() {
    setMode("sign-in");
    setError(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    /*
     * min-h-dvh: better than 100vh on mobile browsers (avoids address-bar CLS).
     * items-start + py-10: sign-up form can scroll naturally without clipping.
     */
    <div
      className="relative min-h-dvh overflow-x-hidden bg-white flex flex-col items-center justify-start py-10 px-5"
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Ambient radial gradient overlays */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(0, 109, 108, 0.08), transparent 40%), radial-gradient(circle at bottom left, rgba(10, 190, 98, 0.08), transparent 40%)",
        }}
      />

      {/* Login card — 440px max, scales down with px-5 gutter on mobile */}
      <div className="relative z-10 w-full" style={{ maxWidth: "440px" }}>
        <div
          className="rounded-[24px] px-8 py-10 sm:p-12"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            boxShadow: "0 32px 64px rgba(0, 0, 0, 0.2)",
            animation: "floatIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            opacity: 0,
            transform: "translateY(30px)",
          }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <Image
              src="/logo.png"
              alt="OpenGrad"
              width={120}
              height={64}
              style={{ height: "64px", width: "auto" }}
            />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1
              className="text-[26px] sm:text-[28px] font-bold text-black mb-2 leading-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {mode === "sign-in" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-[14px] leading-relaxed text-black/70">
              {mode === "sign-in"
                ? "Enter your details to access your learning portal"
                : "Set up your OpenGradHub account"}
            </p>
          </div>

          {/* Sign in / Sign up tab toggle — hidden in Clerk mode (users are created by SA) */}
          {!clerkMode && (
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="grid grid-cols-2 rounded-xl p-1.5 mb-8"
              style={{
                background: "rgba(0, 0, 0, 0.05)",
                border: "1px solid rgba(0, 0, 0, 0.10)",
              }}
            >
              <button
                role="tab"
                type="button"
                aria-selected={mode === "sign-in"}
                onClick={goToSignIn}
                className={`rounded-lg min-h-[44px] px-4 text-sm font-semibold cursor-pointer transition-all ${focusRing} ${
                  mode === "sign-in"
                    ? "bg-[var(--teal)] text-white shadow-[0_4px_12px_rgba(0,109,108,0.28)]"
                    : "text-black/70 hover:text-black"
                }`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Sign in
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={mode === "sign-up"}
                onClick={goToSignUp}
                className={`rounded-lg min-h-[44px] px-4 text-sm font-semibold cursor-pointer transition-all ${focusRing} ${
                  mode === "sign-up"
                    ? "bg-[var(--teal)] text-white shadow-[0_4px_12px_rgba(0,109,108,0.28)]"
                    : "text-black/70 hover:text-black"
                }`}
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Sign up
              </button>
            </div>
          )}

          {/* ----------------------------------------------------------------
              Sign-in form
          ---------------------------------------------------------------- */}
          {mode === "sign-in" ? (
            clerkMode ? (
              <ClerkSignInForm
                initialIdentifier={identifier}
                successMessage={successMessage}
              />
            ) : (
              <form onSubmit={handleSignIn} className="space-y-5">
                {/* Identifier */}
                <div>
                  <label htmlFor="identifier" className={labelClass}>
                    Email or roll number
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <EnvelopeIcon />
                    </span>
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="name@opengrad.edu or OG-STU-001"
                      className={`${inputClass} pl-11 pr-4`}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="password"
                      className="text-[11px] font-semibold uppercase tracking-[0.6px] text-zinc-500"
                    >
                      Password
                    </label>
                    {/* Forgot password: px-1 py-1 gives a larger hit area */}
                    <a
                      href="#"
                      className={`text-[13px] font-medium px-1 py-1 rounded transition-colors cursor-pointer ${focusRing}`}
                      style={{ color: "var(--teal)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--dark-teal)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--teal)")}
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                      <LockIcon />
                    </span>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pl-11 pr-12`}
                      autoComplete="current-password"
                      required
                    />
                    {/* Eye toggle — full-height 44px wide hit area */}
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className={`absolute right-0 top-0 h-full w-[44px] flex items-center justify-center text-zinc-400 hover:text-[var(--teal)] cursor-pointer transition-colors ${focusRing}`}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                {/* Success */}
                {successMessage ? (
                  <p
                    role="status"
                    className="rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/[0.08] px-4 py-3 text-[14px] leading-relaxed text-black/80"
                  >
                    {successMessage}
                  </p>
                ) : null}

                {/* Error */}
                {error ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-400/50 bg-red-50 px-4 py-3 text-[14px] leading-relaxed text-red-700"
                  >
                    {error}
                  </p>
                ) : null}

                <SubmitButton
                  isSubmitting={isSubmitting}
                  label="Sign In to Platform"
                  loadingLabel="Signing in…"
                />
              </form>
            )
          ) : (
            /* --------------------------------------------------------------
               Sign-up form
            -------------------------------------------------------------- */
            <form onSubmit={handleSignUp} className="space-y-5">

              {/* ── Account details ── */}
              <div className="space-y-4">
                {/* Full name */}
                <div>
                  <label htmlFor="fullName" className={labelClass}>
                    Full name <span aria-hidden="true" className="text-red-400 ml-0.5">*</span>
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={signUpForm.fullName}
                    onChange={(e) => updateSignUpField("fullName", e.target.value)}
                    autoComplete="name"
                    className={`${inputClass} px-4`}
                    required
                  />
                </div>

                {/* Role — full width; determines which identity field shows */}
                <div>
                  <label htmlFor="roleCode" className={labelClass}>
                    Role <span aria-hidden="true" className="text-red-400 ml-0.5">*</span>
                  </label>
                  <select
                    id="roleCode"
                    name="roleCode"
                    value={signUpForm.roleCode}
                    onChange={(e) => updateSignUpField("roleCode", e.target.value)}
                    className={`${inputClass} px-4`}
                  >
                    {roleOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Roll number (student) or email (others) — full width */}
                {isStudentSignUp ? (
                  <div>
                    <label htmlFor="rollNumber" className={labelClass}>
                      Roll number <span aria-hidden="true" className="text-red-400 ml-0.5">*</span>
                    </label>
                    <input
                      id="rollNumber"
                      name="rollNumber"
                      type="text"
                      value={signUpForm.rollNumber}
                      onChange={(e) => updateSignUpField("rollNumber", e.target.value)}
                      placeholder="OG-STU-001"
                      className={`${inputClass} px-4`}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="signupEmail" className={labelClass}>
                      Email <span aria-hidden="true" className="text-red-400 ml-0.5">*</span>
                    </label>
                    <input
                      id="signupEmail"
                      name="email"
                      type="email"
                      value={signUpForm.email}
                      onChange={(e) => updateSignUpField("email", e.target.value)}
                      placeholder="name@opengrad.edu"
                      autoComplete="email"
                      className={`${inputClass} px-4`}
                      required
                    />
                  </div>
                )}
              </div>

              {/* ── Optional details ── */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-zinc-400 mb-3">
                  Optional details
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="phone" className={labelClass}>Phone</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={signUpForm.phone}
                      onChange={(e) => updateSignUpField("phone", e.target.value)}
                      autoComplete="tel"
                      className={`${inputClass} px-4`}
                    />
                  </div>

                  <div>
                    <label htmlFor="programme" className={labelClass}>Programme</label>
                    <input
                      id="programme"
                      name="programme"
                      type="text"
                      value={signUpForm.programme}
                      onChange={(e) => updateSignUpField("programme", e.target.value)}
                      className={`${inputClass} px-4`}
                    />
                  </div>

                  <div>
                    <label htmlFor="zone" className={labelClass}>Zone</label>
                    <input
                      id="zone"
                      name="zone"
                      type="text"
                      value={signUpForm.zone}
                      onChange={(e) => updateSignUpField("zone", e.target.value)}
                      className={`${inputClass} px-4`}
                    />
                  </div>

                  <div>
                    <label htmlFor="schoolName" className={labelClass}>School name</label>
                    <input
                      id="schoolName"
                      name="schoolName"
                      type="text"
                      value={signUpForm.schoolName}
                      onChange={(e) => updateSignUpField("schoolName", e.target.value)}
                      className={`${inputClass} px-4`}
                    />
                  </div>
                </div>
              </div>

              {/* ── Password ── */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.6px] text-zinc-400 mb-3">
                  Set a password
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signUpPassword" className={labelClass}>
                      Password <span aria-hidden="true" className="text-red-400 ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="signUpPassword"
                        name="signUpPassword"
                        type={showSignUpPassword ? "text" : "password"}
                        value={signUpForm.password}
                        onChange={(e) => updateSignUpField("password", e.target.value)}
                        className={`${inputClass} px-4 pr-12`}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword((v) => !v)}
                        aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                        className={`absolute right-0 top-0 h-full w-[44px] flex items-center justify-center text-zinc-400 hover:text-[var(--teal)] cursor-pointer transition-colors ${focusRing}`}
                      >
                        {showSignUpPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className={labelClass}>
                      Confirm <span aria-hidden="true" className="text-red-400 ml-0.5">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={signUpForm.confirmPassword}
                      onChange={(e) =>
                        updateSignUpField("confirmPassword", e.target.value)
                      }
                      className={`${inputClass} px-4`}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <p className="text-[11px] text-zinc-400 mt-1">
                  Passwords are hashed before storage.
                </p>
              </div>

              {/* Required note */}
              <p className="text-[11px] text-zinc-400">
                <span aria-hidden="true" className="text-red-400">*</span> Required fields
              </p>

              {/* Error */}
              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-red-400/50 bg-red-50 px-4 py-3 text-[14px] leading-relaxed text-red-700"
                >
                  {error}
                </p>
              ) : null}

              <SubmitButton
                isSubmitting={isSubmitting}
                label="Create Account"
                loadingLabel="Creating account…"
              />
            </form>
          )}

          {/* Footer mode-switch links — hidden in Clerk mode */}
          {!clerkMode && (
            <div className="text-center mt-8 text-[14px] text-black/70">
              {mode === "sign-in" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={goToSignUp}
                    className={`font-semibold cursor-pointer rounded transition-colors ml-1 ${focusRing}`}
                    style={{ color: "var(--teal)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--dark-teal)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--teal)")}
                  >
                    Apply now
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={goToSignIn}
                    className={`font-semibold cursor-pointer rounded transition-colors ml-1 ${focusRing}`}
                    style={{ color: "var(--teal)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--dark-teal)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--teal)")}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
