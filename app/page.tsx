"use client";

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

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
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

  // Clerk hooks must always be called (React rules of hooks).
  // Their values are only used when clerkMode is true.
  const { signIn: clerkSignInResource } = useSignIn();

  useEffect(() => {
    // In custom mode, redirect if already authenticated.
    if (!clerkMode && getStoredAuthToken()) {
      router.replace("/dashboard");
    }
    // In Clerk mode, the proxy handles redirects for authenticated users.
  }, [router, clerkMode]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (clerkMode) {
        // Clerk v7 mode: use the Signal-based SignInFutureResource.
        // Step 1: Create the sign-in attempt with identifier + password.
        const createResult = await clerkSignInResource.create({
          identifier,
          password,
        });

        if (createResult.error) {
          setError(createResult.error.message ?? "Sign-in failed.");
          return;
        }

        // Step 2: If status is complete, finalize the session.
        if (clerkSignInResource.status === "complete") {
          const finalizeResult = await clerkSignInResource.finalize();
          if (finalizeResult.error) {
            setError(finalizeResult.error.message ?? "Could not activate session.");
            return;
          }
          router.replace("/dashboard");
        } else {
          // Unexpected status (e.g. needs_second_factor) — shouldn't happen since MFA is off.
          setError(
            `Sign-in requires additional steps (status: ${clerkSignInResource.status}). Please contact an administrator.`,
          );
        }
      } else {
        // Custom mode: call the backend API.
        const response = await signIn({
          identifier,
          password,
        });

        persistAuthToken(response.accessToken);
        router.replace("/dashboard");
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "We could not sign you in right now.";

      // Clerk errors may contain a nested errors array
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
      // Sign-up always goes through the backend API (which handles both custom and Clerk modes).
      // The backend creates the user in the local DB and, in Clerk mode, also in Clerk.
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
      setSignUpForm((currentState) => ({
        ...currentState,
        password: "",
        confirmPassword: "",
      }));
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

  function updateSignUpField(
    field: keyof typeof signUpForm,
    value: string,
  ) {
    setSignUpForm((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-ink)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,222,0,0.18),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(10,190,98,0.18),_transparent_30%),linear-gradient(135deg,_rgba(0,109,108,0.92),_rgba(3,72,82,1))]" />
      <div className="absolute left-6 top-8 h-32 w-32 rounded-full border border-white/12 bg-[var(--color-green)]/18 blur-2xl sm:left-14 sm:top-14 sm:h-48 sm:w-48" />
      <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full border border-[var(--color-sun)]/20 bg-[var(--color-sun)]/10 blur-3xl sm:h-72 sm:w-72" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-5 py-10 lg:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="px-2 text-white sm:px-4">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[var(--color-sun)]">
              OpenGradHub
            </p>
            <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              {clerkMode
                ? "Clerk-powered authentication for role-based access in OpenGradHub."
                : "Local authentication for role-based access, built directly into OpenGradHub."}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/72 sm:text-lg">
              Non-student users sign in with email and password. Students sign
              in with roll number and password.{" "}
              {clerkMode
                ? "Clerk handles session management and issues secure JWTs that the backend verifies."
                : "Once the backend verifies the credentials, it issues a local JWT and resolves role-aware dashboard access from PostgreSQL."}
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-sun)]">
                  Role-aware
                </p>
                <p className="mt-3 text-sm leading-7 text-white/74">
                  Redirects each signed-in user to the dashboard matched to their local role.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-green)]">
                  Permission-led
                </p>
                <p className="mt-3 text-sm leading-7 text-white/74">
                  Sidebar modules come from the effective permissions stored in Postgres.
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-green-muted)]">
                  {clerkMode ? "Clerk-managed" : "Local-first"}
                </p>
                <p className="mt-3 text-sm leading-7 text-white/74">
                  {clerkMode
                    ? "Authentication and session management are handled by Clerk. Switchable back to local auth."
                    : "Authentication, password hashing, and JWT issuance now stay inside OpenGradHub."}
                </p>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-xl">
            <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(247,255,248,0.98),rgba(238,249,225,0.96))] p-6 text-[var(--color-ink)] shadow-[0_30px_90px_rgba(3,72,82,0.34)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-green-deep)]">
                    {clerkMode ? "Clerk auth" : "Custom access"}
                  </p>
                  <h2 className="font-display mt-3 text-3xl font-semibold text-[var(--color-deep-teal)]">
                    {mode === "sign-in" ? "Sign in" : "Create account"}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--color-ink)]/72">
                    {mode === "sign-in"
                      ? "Use an email for non-student roles or a roll number for student accounts."
                      : "Set up an account that the backend can verify and issue tokens for."}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--color-green-muted)]/40 bg-white px-4 py-3 text-right">
                  <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-green-deep)]">
                    Auth
                  </span>
                  <strong className="font-display mt-1 block text-lg text-[var(--color-deep-teal)]">
                    {clerkMode ? "Clerk" : "Local JWT"}
                  </strong>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 rounded-[1.5rem] border border-[var(--color-green-muted)]/35 bg-white/70 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-in");
                    setError(null);
                  }}
                  className={`rounded-[1.2rem] px-4 py-3 text-sm font-semibold ${
                    mode === "sign-in"
                      ? "bg-[var(--color-deep-teal)] text-white shadow-[0_12px_24px_rgba(0,109,108,0.18)]"
                      : "text-[var(--color-deep-teal)]"
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-up");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`rounded-[1.2rem] px-4 py-3 text-sm font-semibold ${
                    mode === "sign-up"
                      ? "bg-[var(--color-deep-teal)] text-white shadow-[0_12px_24px_rgba(0,109,108,0.18)]"
                      : "text-[var(--color-deep-teal)]"
                  }`}
                >
                  Sign up
                </button>
              </div>

              {mode === "sign-in" ? (
                <form onSubmit={handleSignIn} className="mt-8 space-y-5">
                  <div>
                    <label
                      htmlFor="identifier"
                      className="text-sm font-semibold text-[var(--color-deep-teal)]"
                    >
                      Email or roll number
                    </label>
                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      placeholder="name@opengrad.local or OG-STU-001"
                      className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink)]/36 focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="text-sm font-semibold text-[var(--color-deep-teal)]"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="your password"
                      className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink)]/36 focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  {successMessage ? (
                    <div className="rounded-2xl border border-[var(--color-green)]/40 bg-[var(--color-mint-soft)] px-4 py-3 text-sm text-[var(--color-ink)]">
                      {successMessage}
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-2xl border border-[var(--color-sun)]/55 bg-[var(--color-sun-soft)]/28 px-4 py-3 text-sm text-[var(--color-ink)]">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-[var(--color-deep-teal)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(0,109,108,0.24)] hover:bg-[var(--color-green-deep)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Signing in..." : "Continue to dashboard"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="mt-8 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="fullName"
                        className="text-sm font-semibold text-[var(--color-deep-teal)]"
                      >
                        Full name
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        value={signUpForm.fullName}
                        onChange={(event) => updateSignUpField("fullName", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="roleCode"
                        className="text-sm font-semibold text-[var(--color-deep-teal)]"
                      >
                        Role
                      </label>
                      <select
                        id="roleCode"
                        name="roleCode"
                        value={signUpForm.roleCode}
                        onChange={(event) => updateSignUpField("roleCode", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                      >
                        {roleOptions.map((roleOption) => (
                          <option key={roleOption.value} value={roleOption.value}>
                            {roleOption.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {isStudentSignUp ? (
                      <div>
                        <label
                          htmlFor="rollNumber"
                          className="text-sm font-semibold text-[var(--color-deep-teal)]"
                        >
                          Roll number
                        </label>
                        <input
                          id="rollNumber"
                          name="rollNumber"
                          type="text"
                          value={signUpForm.rollNumber}
                          onChange={(event) => updateSignUpField("rollNumber", event.target.value)}
                          placeholder="OG-STU-001"
                          className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                          required
                        />
                      </div>
                    ) : (
                      <>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="email"
                            className="text-sm font-semibold text-[var(--color-deep-teal)]"
                          >
                            Email
                          </label>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            value={signUpForm.email}
                            onChange={(event) => updateSignUpField("email", event.target.value)}
                            placeholder="name@opengrad.local"
                            className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                            required
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label
                        htmlFor="phone"
                        className="text-sm font-semibold text-[var(--color-deep-teal)]"
                      >
                        Phone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="text"
                        value={signUpForm.phone}
                        onChange={(event) => updateSignUpField("phone", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="programme"
                        className="text-sm font-semibold text-[var(--color-deep-teal)]"
                      >
                        Programme
                      </label>
                      <input
                        id="programme"
                        name="programme"
                        type="text"
                        value={signUpForm.programme}
                        onChange={(event) => updateSignUpField("programme", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="zone"
                        className="text-sm font-semibold text-[var(--color-deep-teal)]"
                      >
                        Zone
                      </label>
                      <input
                        id="zone"
                        name="zone"
                        type="text"
                        value={signUpForm.zone}
                        onChange={(event) => updateSignUpField("zone", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="schoolName"
                        className="text-sm font-semibold text-[var(--color-deep-teal)]"
                      >
                        School name
                      </label>
                      <input
                        id="schoolName"
                        name="schoolName"
                        type="text"
                        value={signUpForm.schoolName}
                        onChange={(event) => updateSignUpField("schoolName", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="signUpPassword"
                        className="text-sm font-semibold text-[var(--color-deep-teal)]"
                      >
                        Password
                      </label>
                      <input
                        id="signUpPassword"
                        name="signUpPassword"
                        type="password"
                        value={signUpForm.password}
                        onChange={(event) => updateSignUpField("password", event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="text-sm font-semibold text-[var(--color-deep-teal)]"
                      >
                        Confirm password
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={signUpForm.confirmPassword}
                        onChange={(event) =>
                          updateSignUpField("confirmPassword", event.target.value)
                        }
                        className="mt-2 w-full rounded-2xl border border-[var(--color-green-muted)]/45 bg-white px-4 py-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-deep-teal)] focus:ring-4 focus:ring-[var(--color-green)]/15"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </div>

                  {error ? (
                    <div className="rounded-2xl border border-[var(--color-sun)]/55 bg-[var(--color-sun-soft)]/28 px-4 py-3 text-sm text-[var(--color-ink)]">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-2xl bg-[var(--color-deep-teal)] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(0,109,108,0.24)] hover:bg-[var(--color-green-deep)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Creating account..." : "Create account"}
                  </button>
                </form>
              )}

              <div className="mt-8 rounded-[1.5rem] border border-[var(--color-green-muted)]/35 bg-white/74 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-green-deep)]">
                  {clerkMode ? "Clerk auth notes" : "Local auth notes"}
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-[var(--color-ink)]/72">
                  <li>Non-student accounts sign in with email + password.</li>
                  <li>Student accounts sign in with roll number + password.</li>
                  <li>
                    {clerkMode
                      ? "Clerk handles authentication. The backend verifies Clerk session tokens."
                      : "The backend hashes passwords before storage and returns a JWT on sign-in."}
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
