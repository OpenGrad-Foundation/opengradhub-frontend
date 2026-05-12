import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const VALID_ROLES = [
  "SUPER_ADMIN", "PROGRAM_MANAGER", "ZONAL_MANAGER",
  "FELLOW", "STUDENT", "GOVERNMENT", "FUNDING_PARTNER",
];

export const MODULES = [
  { code: "dashboard",       name: "Dashboard" },
  { code: "courses",         name: "Courses" },
  { code: "assessments",     name: "Assessments" },
  { code: "resources",       name: "Resources" },
  { code: "doubts",          name: "Doubts" },
  { code: "announcements",   name: "Announcements" },
  { code: "analytics",       name: "Analytics" },
  { code: "student_export",  name: "Student Export" },
  { code: "user_management", name: "User Management" },
  { code: "role_management", name: "Role Management" },
];

export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type Action = typeof ACTIONS[number];

export type Override = {
  id: string;
  module_code: string;
  module_name: string;
  permission_code: string;
  permission_name: string;
  effect: "ALLOW" | "DENY";
  created_at: string;
};

export async function patchRole(userId: string, role: string, callerRole: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, caller_role: callerRole }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to update role.");
  }
}

export async function fetchOverrides(userId: string, callerRole: string): Promise<Override[]> {
  const res = await apiFetch(
    `${API_BASE}/users/${userId}/overrides?caller_role=${callerRole}`,
    { cache: "no-store" },
  );
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
export async function fetchEffectivePermissions(userId: string, callerRole: string): Promise<EffectivePermissions> {
  const res = await apiFetch(`${API_BASE}/users/${userId}/effective?caller_role=${callerRole}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch effective permissions.");
  return res.json() as Promise<EffectivePermissions>;
}

export async function addOverride(
  userId: string,
  permissionCode: string,
  effect: "ALLOW" | "DENY",
  setBy: string,
  callerRole: string,
): Promise<Override[]> {
  const res = await apiFetch(`${API_BASE}/users/${userId}/overrides`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      permission_code: permissionCode,
      effect,
      set_by: setBy,
      caller_role: callerRole,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? "Failed to add override.");
  }
  return res.json() as Promise<Override[]>;
}

export async function deleteOverride(
  userId: string,
  permissionId: string,
  callerRole: string,
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/users/${userId}/overrides/${permissionId}?caller_role=${callerRole}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Failed to delete override.");
}
