export const mockUser = {
  id: "replace-with-a-real-uuid-from-your-db",
  name: "Test User",
  role: "SUPER_ADMIN" as const,
  programme_type: null as "UG" | "PG" | null, // set to "UG" or "PG" when role is STUDENT
};
