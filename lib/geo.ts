export type StateOption = { value: string; label: string };

/** Sentinel state for nationwide / cross-state users. Not valid for schools. */
export const ALL_STATE = "ALL";

/** Single source of truth for the state dropdown everywhere. */
export const STATES: StateOption[] = [
  { value: "KERALA",       label: "Kerala" },
  { value: "KARNATAKA",    label: "Karnataka" },
  { value: "TAMIL_NADU",   label: "Tamil Nadu" },
  { value: "CHHATTISGARH", label: "Chhattisgarh" },
  { value: ALL_STATE,      label: "All" },
];

/**
 * Official district lists per state. District values are stored verbatim
 * (e.g. "Ernakulam"). Edit lists HERE only — every dropdown reads from this.
 */
export const STATE_DISTRICTS: Record<string, string[]> = {
  KERALA: [
    "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha", "Kottayam",
    "Idukki", "Ernakulam", "Thrissur", "Palakkad", "Malappuram", "Kozhikode",
    "Wayanad", "Kannur", "Kasaragod",
  ],
  KARNATAKA: [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
    "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga",
    "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri",
    "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur",
    "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada",
    "Vijayanagara", "Vijayapura", "Yadgir",
  ],
  TAMIL_NADU: [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
    "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kancheepuram",
    "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
    "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
    "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur",
    "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur",
    "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore",
    "Viluppuram", "Virudhunagar",
  ],
  CHHATTISGARH: [
    "Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara", "Bijapur",
    "Bilaspur", "Dantewada", "Dhamtari", "Durg", "Gariaband",
    "Gaurela-Pendra-Marwahi", "Janjgir-Champa", "Jashpur", "Kabirdham",
    "Kanker", "Khairagarh-Chhuikhadan-Gandai", "Kondagaon", "Korba", "Koriya",
    "Mahasamund", "Manendragarh-Chirmiri-Bharatpur",
    "Mohla-Manpur-Ambagarh Chowki", "Mungeli", "Narayanpur", "Raigarh",
    "Raipur", "Rajnandgaon", "Sakti", "Sarangarh-Bilaigarh", "Sukma",
    "Surajpur", "Surguja",
  ],
  [ALL_STATE]: [],
};

/** Canonicalize a state string to a STATES value form. */
export const normState = (s: string | null | undefined): string =>
  (s ?? "").trim().toUpperCase().replace(/\s+/g, "_");

/** Districts for a state (accepts label or value form); [] for ALL/unknown/empty. */
export function districtsForState(state: string | null | undefined): string[] {
  return STATE_DISTRICTS[normState(state)] ?? [];
}

/** District control is unusable when no real state is chosen (empty or ALL). */
export function districtDisabled(state: string | null | undefined): boolean {
  const s = normState(state);
  return s === "" || s === ALL_STATE;
}

/** True only for a real state (not empty, not ALL, not unknown). */
export function isKnownState(state: string | null | undefined): boolean {
  const s = normState(state);
  return s !== "" && s !== ALL_STATE && s in STATE_DISTRICTS;
}

/** True if district belongs to the given state's official list. */
export function isValidDistrictForState(
  state: string | null | undefined,
  district: string | null | undefined,
): boolean {
  const d = (district ?? "").trim();
  if (!d) return false;
  return districtsForState(state).includes(d);
}
