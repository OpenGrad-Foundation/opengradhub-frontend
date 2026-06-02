import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ── Permission catalogue (server-driven) ──────────────────────────────────────
// The module/action matrix is no longer hand-maintained here — it comes from
// `GET /permissions/catalogue`, which is the same data the backend
// `@RequirePermission(...)` decorators are checked against.

export type CatalogueModule = {
  code: string;
  name: string;
  description: string | null;
  permissions: Array<{ code: string; name: string }>;
};

export type PermissionCatalogue = {
  modules: CatalogueModule[];
  roles: Array<{ code: string; name: string }>;
};

export async function fetchCatalogue(): Promise<PermissionCatalogue> {
  const res = await apiFetch(`${API_BASE}/permissions/catalogue`);
  if (!res.ok) throw new Error("Failed to load permission catalogue.");
  return res.json() as Promise<PermissionCatalogue>;
}

/** Default permission codes granted to a role (the `role_permissions` rows). */
export async function fetchRoleDefaults(roleCode: string): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/permissions/roles/${encodeURIComponent(roleCode)}`);
  if (!res.ok) throw new Error("Failed to load role defaults.");
  return res.json() as Promise<string[]>;
}

// ── Overrides + role assignment ───────────────────────────────────────────────
// No `caller_role` is sent — the backend derives the caller (and gates the
// action: `role_management.assign_role` / `role_management.manage_overrides`)
// from the JWT.

export type Override = {
  id: string;
  module_code: string;
  module_name: string;
  permission_code: string;
  permission_name: string;
  effect: "ALLOW" | "DENY";
  created_at: string;
};

export async function patchRole(userId: string, role: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to update role.");
  }
}

export async function fetchOverrides(userId: string): Promise<Override[]> {
  const res = await apiFetch(`${API_BASE}/users/${userId}/overrides`);
  if (!res.ok) throw new Error("Failed to fetch overrides.");
  return res.json() as Promise<Override[]>;
}

export type EffectivePermissions = {
  permissions: string[];
  modules: Array<{
    code: string;
    name: string;
    permissions: Array<{ code: string; name: string; grantedBy: string }>;
  }>;
};

export async function fetchEffectivePermissions(userId: string): Promise<EffectivePermissions> {
  const res = await apiFetch(`${API_BASE}/users/${userId}/effective`);
  if (!res.ok) throw new Error("Failed to fetch effective permissions.");
  return res.json() as Promise<EffectivePermissions>;
}

export async function addOverride(
  userId: string,
  permissionCode: string,
  effect: "ALLOW" | "DENY",
  setBy: string,
): Promise<Override[]> {
  const res = await apiFetch(`${API_BASE}/users/${userId}/overrides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      permission_code: permissionCode,
      effect,
      set_by: setBy,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to add override.");
  }
  return res.json() as Promise<Override[]>;
}

export async function deleteOverride(userId: string, permissionId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/users/${userId}/overrides/${permissionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete override.");
}

// ── Role-level management (defaults editing + CRUD) ───────────────────────────

/** Role codes seeded by migrations — not deletable. */
export const BUILTIN_ROLES = [
  "SUPER_ADMIN",
  "PROGRAM_MANAGER",
  "ZONAL_MANAGER",
  "FELLOW",
  "STUDENT",
  "GOVERNMENT",
  "FUNDING_PARTNER",
] as const;

export async function fetchRoles(): Promise<Array<{ code: string; name: string }>> {
  const res = await apiFetch(`${API_BASE}/permissions/roles`);
  if (!res.ok) throw new Error("Failed to load roles.");
  return res.json() as Promise<Array<{ code: string; name: string }>>;
}

/** Replace a role's default permission set with exactly `permissions`. */
export async function putRoleDefaults(
  roleCode: string,
  permissions: string[],
): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/permissions/roles/${encodeURIComponent(roleCode)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ permissions }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to update role permissions.");
  }
  return res.json() as Promise<string[]>;
}

export async function createRole(input: {
  code: string;
  name: string;
  permissions?: string[];
}): Promise<{ code: string; name: string }> {
  const res = await apiFetch(`${API_BASE}/permissions/roles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to create role.");
  }
  return res.json() as Promise<{ code: string; name: string }>;
}

export async function deleteRole(roleCode: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/permissions/roles/${encodeURIComponent(roleCode)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to delete role.");
  }
}
