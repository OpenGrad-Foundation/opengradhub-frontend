import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';

type Result = { error: { message: string } | null };
const ok: Result = { error: null };
const fail = (message: string): Result => ({ error: { message } });

type FakeSignIn = {
  status: string;
  supportedFirstFactors: unknown[];
  create: Mock;
  resetPasswordEmailCode: { sendCode: Mock; verifyCode: Mock; submitPassword: Mock };
  finalize: Mock;
};

// Fake Clerk Core 3 SignInFuture: each step mutates `status` like the real
// resource. Per-test queues decide whether a call succeeds or errors.
const state = vi.hoisted(() => ({
  signIn: null as null | FakeSignIn,
  verify: [] as Result[],
  submit: [] as Result[],
  finalize: [] as Result[],
}));

function makeSignIn() {
  const signIn: FakeSignIn = {
    status: 'needs_identifier',
    supportedFirstFactors: [],
    create: vi.fn(async () => {
      signIn.status = 'needs_first_factor';
      signIn.supportedFirstFactors = [{ strategy: 'reset_password_email_code', safeIdentifier: 'a***@x.com' }];
      return ok;
    }),
    resetPasswordEmailCode: {
      sendCode: vi.fn(async () => ok),
      verifyCode: vi.fn(async () => {
        if (signIn.status !== 'needs_first_factor') return fail('already verified');
        const r = state.verify.shift() ?? ok;
        if (!r.error) signIn.status = 'needs_new_password';
        return r;
      }),
      submitPassword: vi.fn(async () => {
        if (signIn.status !== 'needs_new_password') return fail('wrong state');
        const r = state.submit.shift() ?? ok;
        if (!r.error) signIn.status = 'complete';
        return r;
      }),
    },
    finalize: vi.fn(async () => state.finalize.shift() ?? ok),
  };
  return signIn;
}

vi.mock('@clerk/nextjs', () => ({ useSignIn: () => ({ signIn: state.signIn }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('../lib/auth-session', () => ({
  getStoredAuthToken: () => null,
  isClerkMode: () => true,
  persistAuthToken: () => {},
}));

import LoginPage from '../app/page';

const replace = vi.fn();

beforeEach(() => {
  state.signIn = makeSignIn();
  state.verify = [];
  state.submit = [];
  state.finalize = [];
  replace.mockReset();
  Object.defineProperty(window, 'location', { value: { ...window.location, replace }, writable: true });
});
afterEach(cleanup);

async function openCodeStep() {
  render(<LoginPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  fireEvent.change(screen.getByLabelText('Email or roll number'), { target: { value: 'a@x.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
  await screen.findByLabelText('Reset code');
}

function fill(code: string, password: string) {
  fireEvent.change(screen.getByLabelText('Reset code'), { target: { value: code } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: password } });
}

async function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Set new password' }) as HTMLInputElement).disabled).toBe(false));
}

const sdk = () => state.signIn!.resetPasswordEmailCode;

it('resets on first try', async () => {
  await openCodeStep();
  fill('123456', 'Str0ng-pass!');
  await submit();
  expect(sdk().verifyCode).toHaveBeenCalledTimes(1);
  expect(sdk().submitPassword).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith('/dashboard');
});

it('rejected password then retry does not re-verify the code', async () => {
  state.submit = [fail('Password has been found in an online data breach.')];
  await openCodeStep();
  fill('123456', 'password123');
  await submit();
  expect(screen.getByRole('alert').textContent).toContain('data breach');
  expect(replace).not.toHaveBeenCalled();
  // Code already accepted: field is locked, so clearing it can't block submit.
  expect((screen.getByLabelText('Reset code') as HTMLInputElement).disabled).toBe(true);

  fill('', 'Str0ng-pass!');
  await submit();
  expect(sdk().verifyCode).toHaveBeenCalledTimes(1);
  expect(sdk().submitPassword).toHaveBeenCalledTimes(2);
  expect(replace).toHaveBeenCalledWith('/dashboard');
});

it('finalize failure then retry only re-runs finalize', async () => {
  state.finalize = [fail('Network error')];
  await openCodeStep();
  fill('123456', 'Str0ng-pass!');
  await submit();
  expect(screen.getByRole('alert').textContent).toContain('Network error');
  expect(replace).not.toHaveBeenCalled();
  // Password already saved: fields locked and not re-validated.
  expect((screen.getByLabelText('New password') as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText('Confirm new password') as HTMLInputElement).disabled).toBe(true);

  // Password already saved: a now-invalid local value must not block finalize.
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'x' } });
  await submit();
  expect(sdk().verifyCode).toHaveBeenCalledTimes(1);
  expect(sdk().submitPassword).toHaveBeenCalledTimes(1);
  expect(state.signIn!.finalize).toHaveBeenCalledTimes(2);
  expect(replace).toHaveBeenCalledWith('/dashboard');
});

it('invalid code then retry verifies again', async () => {
  state.verify = [fail('Incorrect code')];
  await openCodeStep();
  fill('000000', 'Str0ng-pass!');
  await submit();
  expect(screen.getByRole('alert').textContent).toContain('Incorrect code');
  expect((screen.getByLabelText('Reset code') as HTMLInputElement).disabled).toBe(false);

  fill('123456', 'Str0ng-pass!');
  await submit();
  expect(sdk().verifyCode).toHaveBeenCalledTimes(2);
  expect(sdk().submitPassword).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith('/dashboard');
});
