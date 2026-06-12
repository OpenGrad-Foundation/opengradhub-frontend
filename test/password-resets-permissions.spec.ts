import { describe, it, expect } from 'vitest';
import { PERM } from '../lib/permissions';

describe('password_resets module split', () => {
  it('exposes password_resets permission codes', () => {
    expect(PERM.password_resets.view).toBe('password_resets.view');
    expect(PERM.password_resets.manage).toBe('password_resets.manage');
  });

  it('user_management no longer carries password reset codes', () => {
    const codes = Object.values(PERM.user_management);
    expect(codes).not.toContain('user_management.password_reset_view');
    expect(codes).not.toContain('user_management.password_reset_manage');
  });
});
