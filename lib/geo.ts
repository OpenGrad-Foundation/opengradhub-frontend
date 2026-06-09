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

/**
 * Canonicalize a state string to a STATES value form.
 * Accepts either stored value ("TAMIL_NADU") or display label ("Tamil Nadu").
 */
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

export type ResolveStatus = "exact" | "corrected" | "ambiguous" | "unknown" | "none";
export type ResolveResult = { status: ResolveStatus; value: string; candidates?: string[] };

/** Lowercase and strip non-alphanumerics (accepts null/undefined safely). */
export function normalizeForMatch(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Levenshtein edit distance. */
export function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

const FUZZY_THRESHOLD = 2;

// Resolve a raw string against a list of canonical candidates.
function resolveAgainst(raw: string, canonicals: string[]): ResolveResult {
  const r = (raw ?? "").trim();
  if (!r) return { status: "none", value: "" };
  const nraw = normalizeForMatch(r);
  const exact = canonicals.find((c) => normalizeForMatch(c) === nraw);
  if (exact) return { status: "exact", value: exact };
  let best = Infinity;
  let winners: string[] = [];
  for (const c of canonicals) {
    const d = editDistance(nraw, normalizeForMatch(c));
    if (d < best) { best = d; winners = [c]; }
    else if (d === best) winners.push(c);
  }
  if (best <= FUZZY_THRESHOLD) {
    if (winners.length === 1) return { status: "corrected", value: winners[0] };
    return { status: "ambiguous", value: r, candidates: [...winners].sort() };
  }
  return { status: "unknown", value: r };
}

/** Resolve a district against the chosen state's official list. */
export function resolveDistrict(state: string, rawDistrict: string): ResolveResult {
  const r = (rawDistrict ?? "").trim();
  if (!r) return { status: "none", value: "" };
  if (!isKnownState(state)) return { status: "unknown", value: r };
  return resolveAgainst(r, STATE_DISTRICTS[normState(state)]);
}

/** Resolve a state against STATES (value or label form; "all" -> ALL). */
export function resolveState(rawState: string): ResolveResult {
  const r = (rawState ?? "").trim();
  if (!r) return { status: "none", value: "" };
  const nraw = normalizeForMatch(r);
  const exact = STATES.find(
    (s) => normalizeForMatch(s.value) === nraw || normalizeForMatch(s.label) === nraw,
  );
  if (exact) return { status: "exact", value: exact.value };
  let best = Infinity;
  let winners: StateOption[] = [];
  for (const s of STATES) {
    const d = Math.min(
      editDistance(nraw, normalizeForMatch(s.value)),
      editDistance(nraw, normalizeForMatch(s.label)),
    );
    if (d < best) { best = d; winners = [s]; }
    else if (d === best) winners.push(s);
  }
  if (best <= FUZZY_THRESHOLD) {
    if (winners.length === 1) return { status: "corrected", value: winners[0].value };
    return { status: "ambiguous", value: r, candidates: winners.map((w) => w.value).sort() };
  }
  return { status: "unknown", value: r };
}
