import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const api = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn(), put: vi.fn() }));
vi.mock('../hooks/use-is-mobile', () => ({ useIsMobile: () => false }));
vi.mock('../hooks/use-current-user', () => ({ clearUserCache: vi.fn() }));
vi.mock('../app/dashboard/role-management/role-management.utils', () => ({
  BUILTIN_ROLES: [],
  fetchCatalogue: async () => ({ modules: [{ code: 'scope', name: 'Scope', permissions: [
    { code: 'scope.self', name: 'Self' }, { code: 'scope.subtree', name: 'Subtree' }, { code: 'scope.unrestricted', name: 'Unrestricted' },
  ] }] }),
  fetchOverrides: async () => [{ id: 'chosen', permission_code: 'scope.subtree', effect: 'ALLOW' }, { id: 'deny', permission_code: 'courses.edit', effect: 'DENY' }],
  fetchEffectivePermissions: async () => ({ permissions: ['scope.subtree'], modules: [] }),
  fetchRoleDefaults: async () => ['scope.subtree', 'courses.view'],
  addOverride: api.add, deleteOverride: api.remove, putRoleDefaults: api.put,
}));
import { UserOverrideEditor } from '../app/dashboard/_components/UserOverrideEditor';
import { RolePermissionPanel } from '../app/dashboard/_components/RolePermissionPanel';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('single choice permission scope editor', () => {
  it('saves only the last selected user scope with one atomic API change', async () => {
    render(<UserOverrideEditor userId="target" callerId="caller" />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Self' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Unrestricted' }));
    expect(screen.queryByRole('button', { name: 'Deny' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save (1)' }));
    await waitFor(() => expect(api.add).toHaveBeenCalledWith('target', 'scope.unrestricted', 'ALLOW', 'caller'));
    expect(api.add).toHaveBeenCalledTimes(1);
    expect(api.remove).not.toHaveBeenCalled();
  });
  it('labels reset explicitly and removes only the selected scope group', async () => {
    render(<UserOverrideEditor userId="target" callerId="caller" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reset scope to role default' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save (1)' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('target', 'chosen'));
    expect(api.remove).toHaveBeenCalledTimes(1);
    expect(api.add).not.toHaveBeenCalled();
  });
  it('replaces role scope while retaining action grants in the atomic role save', async () => {
    render(<RolePermissionPanel roleCode="CUSTOM" roleName="Custom" canManage onClose={() => {}} onSaved={() => {}} onDeleted={() => {}} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Unrestricted' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('CUSTOM', ['courses.view', 'scope.unrestricted']));
  });
});
