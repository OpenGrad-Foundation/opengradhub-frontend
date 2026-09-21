import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PushNudge from '@/components/PushNudge';

const enable = vi.fn();
let supported = true;
let subscribed = false;
let permission: NotificationPermission = 'default';
vi.mock('@/lib/push/use-push', () => ({ usePush: () => ({ supported, subscribed, permission, enable }) }));

beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  supported = true;
  subscribed = false;
  permission = 'default';
  enable.mockReset().mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllGlobals());

describe('one-time notification offer', () => {
  it('opens a named dialog without requesting permission, and never repeats after remount', () => {
    const view = render(<PushNudge />);
    expect(screen.getByRole('dialog', { name: 'Turn on task notifications' })).toBeTruthy();
    expect(enable).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('push-nudge-dismissed')).toBe('1');
    view.unmount();
    render(<PushNudge />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['Not now', 'Close', 'Escape'])('dismisses with %s and restores focus', (action) => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    render(<PushNudge />);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    if (action === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
    else fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('honours existing dismissals', () => {
    window.localStorage.setItem('push-nudge-dismissed', '1');
    render(<PushNudge />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['unsupported', 'subscribed', 'denied', 'granted'])('does not offer notifications when %s', (state) => {
    supported = state !== 'unsupported';
    subscribed = state === 'subscribed';
    if (state === 'denied' || state === 'granted') permission = state;
    render(<PushNudge />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem('push-nudge-dismissed')).toBeNull();
  });

  it('enables only on explicit action and prevents repeated clicks while pending', async () => {
    let finish!: () => void;
    enable.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<PushNudge />);
    fireEvent.click(screen.getByRole('button', { name: 'Enable notifications' }));
    expect(screen.getByRole('button', { name: 'Enabling…' }).hasAttribute('disabled')).toBe(true);
    expect(enable).toHaveBeenCalledOnce();
    finish();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows a recoverable error instead of losing the prompt', async () => {
    enable.mockRejectedValueOnce(new Error('Unavailable'));
    render(<PushNudge />);
    fireEvent.click(screen.getByRole('button', { name: 'Enable notifications' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Notifications couldn’t be enabled');
    expect(screen.getByRole('button', { name: 'Enable notifications' }).hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Enable notifications' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
