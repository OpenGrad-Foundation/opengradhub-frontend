export const mockUser = {
  // Only the `id` field matters — name and role are fetched from the DB.
  // Change this UUID to switch users. See schema/seed_test_users.sql for all IDs:
  //   ...0001 = Super Admin    ...0004 = Fellow
  //   ...0002 = Program Mgr    ...0005 = Student
  //   ...0003 = Zonal Mgr      ...0006 = Government
  //                             ...0007 = Funding Partner
  id: "10000000-0000-0000-0000-000000000001",

  // Vestigial — these are overridden by the API response from getMe().
  // Kept for backward compatibility if USE_MOCK is turned off.
  name: "Demo Fellow",
  role: "FELLOW" as const,
  programme_type: null as "UG" | "PG" | null,
};
