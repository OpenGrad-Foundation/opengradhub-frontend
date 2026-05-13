"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import {
  getStudentsForBulk,
  bulkEnrol,
  bulkRemove,
  getEnrolledItemsForStudents,
  getCourses,
  getBundles,
  type StudentForBulk,
  type Course,
  type Bundle,
  type EnrolledItems,
} from "@/lib/api";

const STATES = [
  { value: "TAMIL_NADU",    label: "Tamil Nadu" },
  { value: "CHHATTISGARH", label: "Chhattisgarh" },
  { value: "KERALA",        label: "Kerala" },
];

type Mode = "assign" | "remove";

export default function BulkManagePage() {
  const { isLoading: userLoading } = useCurrentUser();
  const { has } = usePermissions();
  const canManage  = has(PERM.bulk_assign.run);

  // ── Mode toggle ────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("assign");

  // ── Step 1: filters + student selection ───────────────────────
  const [filterState,    setFilterState]    = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [filterSchool,   setFilterSchool]   = useState("");
  const [filterProg,     setFilterProg]     = useState("");
  const [filterSearch,   setFilterSearch]   = useState("");
  const [students,       setStudents]       = useState<StudentForBulk[]>([]);
  const [searching,      setSearching]      = useState(false);
  const [searchErr,      setSearchErr]      = useState<string | null>(null);
  const [hasSearched,    setHasSearched]    = useState(false);
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());

  // ── Step 2 — Assign mode: all courses + bundles ────────────────
  const [allCourses,        setAllCourses]        = useState<Course[]>([]);
  const [allBundles,        setAllBundles]        = useState<Bundle[]>([]);

  // ── Step 2 — Remove mode: enrolled items only ─────────────────
  const [enrolledItems,     setEnrolledItems]     = useState<EnrolledItems>({ courses: [], bundles: [] });
  const [enrolledLoading,   setEnrolledLoading]   = useState(false);

  // ── Step 2: shared selection state ─────────────────────────��──
  const [courseSearch,      setCourseSearch]      = useState("");
  const [bundleSearch,      setBundleSearch]      = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(new Set());

  // ── Step 3: modal + toast ──────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [acting,    setActing]    = useState(false);
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Ref to cancel in-flight enrolled-items requests
  const enrolledFetchId = useRef(0);

  // ── Load all courses + bundles for Assign mode ─────────────────
  useEffect(() => {
    if (userLoading || !canManage) return;
    getCourses(undefined, undefined, undefined, true).then(setAllCourses).catch(() => {});
    getBundles().then(setAllBundles).catch(() => {});
  }, [userLoading, canManage]);

  // ── Fetch enrolled items when Remove mode + students selected ──
  const selectedIdsKey = Array.from(selectedIds).sort().join(",");
  useEffect(() => {
    if (mode !== "remove" || selectedIds.size === 0) {
      setEnrolledItems({ courses: [], bundles: [] });
      return;
    }
    const fetchId = ++enrolledFetchId.current;
    setEnrolledLoading(true);
    getEnrolledItemsForStudents(Array.from(selectedIds))
      .then((items) => {
        if (fetchId === enrolledFetchId.current) setEnrolledItems(items);
      })
      .catch(() => {})
      .finally(() => {
        if (fetchId === enrolledFetchId.current) setEnrolledLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedIdsKey]);

  // ── Toast auto-dismiss ─────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Mode switch — reset selections ────────────────��────────────
  function switchMode(next: Mode) {
    setMode(next);
    setSelectedCourseIds(new Set());
    setSelectedBundleIds(new Set());
    setCourseSearch("");
    setBundleSearch("");
  }

  // ── Handlers ───────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setSearchErr(null);
    setSelectedIds(new Set());
    setSelectedCourseIds(new Set());
    setSelectedBundleIds(new Set());
    try {
      const results = await getStudentsForBulk({
        state:          filterState    || undefined,
        district:       filterDistrict || undefined,
        school_id:      filterSchool   || undefined,
        programme_type: filterProg     || undefined,
        search:         filterSearch   || undefined,
      });
      setStudents(results);
      setHasSearched(true);
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : "Failed to search.");
    } finally {
      setSearching(false);
    }
  }, [filterState, filterDistrict, filterSchool, filterProg, filterSearch]);

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(
      selectedIds.size === students.length
        ? new Set()
        : new Set(students.map((s) => s.id))
    );
  }

  function toggleCourse(id: string) {
    setSelectedCourseIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleBundle(id: string) {
    setSelectedBundleIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAction() {
    setActing(true);
    const nC = selectedCourseIds.size;
    const nB = selectedBundleIds.size;
    const nS = selectedIds.size;
    try {
      if (mode === "assign") {
        const result = await bulkEnrol({
          student_ids: Array.from(selectedIds),
          course_ids:  Array.from(selectedCourseIds),
          bundle_ids:  Array.from(selectedBundleIds),
        });
        const parts: string[] = [];
        if (nC > 0) parts.push(`${nC} course${nC !== 1 ? "s" : ""}`);
        if (nB > 0) parts.push(`${nB} bundle${nB !== 1 ? "s" : ""}`);
        setToast({
          msg: `Done. Assigned ${parts.join(" and ")} to ${nS} student${nS !== 1 ? "s" : ""}. ${result.skipped} already enrolled, skipped.`,
          ok: true,
        });
      } else {
        const result = await bulkRemove({
          student_ids: Array.from(selectedIds),
          course_ids:  Array.from(selectedCourseIds),
          bundle_ids:  Array.from(selectedBundleIds),
        });
        const parts: string[] = [];
        if (nC > 0) parts.push(`${nC} course${nC !== 1 ? "s" : ""}`);
        if (nB > 0) parts.push(`${nB} bundle${nB !== 1 ? "s" : ""}`);
        setToast({
          msg: `Done. Removed ${parts.join(" and ")} from ${nS} student${nS !== 1 ? "s" : ""}. ${result.not_enrolled} were not enrolled, skipped.`,
          ok: true,
        });
      }
      setShowModal(false);
      setSelectedIds(new Set());
      setSelectedCourseIds(new Set());
      setSelectedBundleIds(new Set());
    } catch (e) {
      setShowModal(false);
      setToast({ msg: e instanceof Error ? e.message : "Action failed.", ok: false });
    } finally {
      setActing(false);
    }
  }

  // ── Derived ───────────────────────────���────────────────────────

  const selectedCount    = selectedIds.size;
  const allSelected      = students.length > 0 && selectedIds.size === students.length;
  const someSelected     = selectedIds.size > 0 && selectedIds.size < students.length;

  // Which lists to show in Step 2 depends on mode
  const coursePool = mode === "assign"
    ? allCourses
    : enrolledItems.courses.map((c) => ({ ...c, description: null, cover_image_url: null, locking_mode: "", access_type: "", status: "ACTIVE", created_by: "", created_at: "" } as Course));
  const bundlePool = mode === "assign"
    ? allBundles
    : enrolledItems.bundles.map((b) => ({ ...b, description: null, created_by: null, created_at: "", student_count: 0 } as Bundle));

  const filteredCourses  = coursePool.filter((c) => c.title.toLowerCase().includes(courseSearch.toLowerCase()));
  const filteredBundles  = bundlePool.filter((b) => b.name.toLowerCase().includes(bundleSearch.toLowerCase()));
  const selectedCourses  = coursePool.filter((c) => selectedCourseIds.has(c.id));
  const selectedBundles  = bundlePool.filter((b) => selectedBundleIds.has(b.id));
  const canAct           = selectedCount > 0 && (selectedCourseIds.size > 0 || selectedBundleIds.size > 0);
  const selectionSummary = (() => {
    const parts: string[] = [];
    if (selectedCourseIds.size > 0) parts.push(`${selectedCourseIds.size} course${selectedCourseIds.size !== 1 ? "s" : ""}`);
    if (selectedBundleIds.size > 0) parts.push(`${selectedBundleIds.size} bundle${selectedBundleIds.size !== 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(", ") + " selected" : null;
  })();

  // ── Guards ─────────────────────────────────────────────────────

  if (userLoading) return <LoadingShell />;

  if (!canManage) {
    return (
      <div style={glassCard}>
        <p style={labelStyle}>Access Denied</p>
        <p style={{ ...headingStyle, fontSize: "18px", marginTop: "12px" }}>
          You don&apos;t have permission to run bulk assignments.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: "1100px", position: "relative" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "32px", right: "32px", zIndex: 9999,
          padding: "14px 20px", borderRadius: "14px",
          background: toast.ok ? "#034852" : "#c53030",
          color: "#fff", fontSize: "14px", fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)", maxWidth: "460px", lineHeight: 1.6,
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <p style={labelStyle}>Enrolment</p>
        <h1 style={{ ...headingStyle, fontSize: "28px", margin: "4px 0 12px" }}>Bulk Manage</h1>

        {/* Mode toggle */}
        <div style={{ display: "inline-flex", borderRadius: "12px", border: "1.5px solid rgba(3,72,82,0.15)", overflow: "hidden", background: "#ffffff" }}>
          {(["assign", "remove"] as Mode[]).map((m) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              padding: "9px 24px", border: "none", cursor: "pointer",
              background: mode === m
                ? (m === "assign" ? "linear-gradient(135deg,#0abe62,#006d6c)" : "linear-gradient(135deg,#e53e3e,#c53030)")
                : "transparent",
              color: mode === m ? "#fff" : "rgba(3,72,82,0.6)",
              fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "13px",
              transition: "all 150ms",
            }}>
              {m === "assign" ? "Assign" : "Remove"}
            </button>
          ))}
        </div>

        <p style={{ ...subStyle, marginTop: "10px" }}>
          {mode === "assign"
            ? "Filter students, select them, then assign any number of courses and bundles at once."
            : "Filter students, select them, then remove their enrolments from courses and bundles."}
        </p>
      </div>

      {/* ── Step 1: Filter bar ────────────────────────────────── */}
      <div style={{ ...glassCard, marginBottom: "20px" }}>
        <p style={{ ...labelStyle, marginBottom: "16px" }}>Step 1 — Filter Students</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={fieldLabel}>State</label>
            <select value={filterState} onChange={(e) => setFilterState(e.target.value)} style={inputStyle}>
              <option value="">All States</option>
              {STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>District</label>
            <input type="text" placeholder="e.g. Chennai" value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)} style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()} />
          </div>
          <div>
            <label style={fieldLabel}>School</label>
            <input type="text" placeholder="School name" value={filterSchool}
              onChange={(e) => setFilterSchool(e.target.value)} style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()} />
          </div>
          <div>
            <label style={fieldLabel}>Programme Type</label>
            <select value={filterProg} onChange={(e) => setFilterProg(e.target.value)} style={inputStyle}>
              <option value="">All</option>
              <option value="UG">UG</option>
              <option value="PG">PG</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Search</label>
            <input type="text" placeholder="Name or roll number" value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)} style={inputStyle}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()} />
          </div>
        </div>
        <button onClick={() => void handleSearch()} disabled={searching}
          style={{ ...primaryBtn(mode), opacity: searching ? 0.7 : 1, cursor: searching ? "not-allowed" : "pointer" }}>
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {searchErr && (
        <div style={{ ...glassCard, marginBottom: "20px", background: "rgba(229,62,62,0.06)", borderColor: "rgba(229,62,62,0.2)" }}>
          <p style={{ color: "#c53030", fontWeight: 600, margin: 0 }}>{searchErr}</p>
        </div>
      )}

      {/* Student results table */}
      {hasSearched && !searchErr && (
        <div style={{ ...glassCard, marginBottom: "20px", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(3,72,82,0.08)", display: "flex", alignItems: "center", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                style={{ accentColor: "#0abe62", width: "16px", height: "16px" }}
              />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#034852" }}>
                {students.length === 0 ? "No students found" : `${selectedCount} of ${students.length} selected`}
              </span>
            </label>
          </div>

          {students.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={subStyle}>No students match your filters. Try broadening your search.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "rgba(3,72,82,0.04)" }}>
                    <th style={thStyle}></th>
                    {["Name", "Roll Number", "Programme", "State", "District", "School"].map((h) => (
                      <th key={h} style={{ ...thStyle, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const checked = selectedIds.has(s.id);
                    return (
                      <tr key={s.id} onClick={() => toggleStudent(s.id)}
                        style={{ borderTop: i > 0 ? "1px solid rgba(3,72,82,0.06)" : "none", background: checked ? "rgba(10,190,98,0.06)" : "transparent", cursor: "pointer" }}>
                        <td style={{ ...tdStyle, width: "40px", textAlign: "center" }}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleStudent(s.id)} onClick={(e) => e.stopPropagation()}
                            style={{ accentColor: "#0abe62", width: "15px", height: "15px" }} />
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "#034852" }}>{s.name}</td>
                        <td style={{ ...tdStyle, fontFamily: "monospace", color: "rgba(3,72,82,0.6)" }}>{s.roll_number ?? "—"}</td>
                        <td style={tdStyle}>
                          {s.programme_type ? (
                            <span style={{ padding: "2px 8px", borderRadius: "100px", background: "rgba(32,147,121,0.1)", color: "#209379", fontSize: "11px", fontWeight: 700 }}>
                              {s.programme_type}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={tdStyle}>{s.state ?? "—"}</td>
                        <td style={tdStyle}>{s.district ?? "—"}</td>
                        <td style={{ ...tdStyle, color: "rgba(3,72,82,0.65)" }}>{s.school_name ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Course + bundle picker ───────────────────── */}
      {selectedCount > 0 && (
        <div style={{ ...glassCard, marginBottom: "20px" }}>
          <p style={{ ...labelStyle, marginBottom: "20px" }}>
            Step 2 — {mode === "assign" ? "Choose What to Assign" : "Choose What to Remove"}
            <span style={{ marginLeft: "10px", color: "#034852", fontFamily: "var(--font-body)", textTransform: "none", letterSpacing: 0, fontSize: "13px", fontWeight: 600 }}>
              ({selectedCount} student{selectedCount !== 1 ? "s" : ""} selected)
            </span>
          </p>

          {/* Remove mode: loading enrolled items */}
          {mode === "remove" && enrolledLoading && (
            <p style={{ fontSize: "13px", color: "rgba(3,72,82,0.5)", marginBottom: "16px" }}>
              Loading enrolled courses and bundles…
            </p>
          )}

          {/* Remove mode: no enrolments found */}
          {mode === "remove" && !enrolledLoading && enrolledItems.courses.length === 0 && enrolledItems.bundles.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", border: "1px dashed rgba(3,72,82,0.2)", borderRadius: "12px", marginBottom: "16px" }}>
              <p style={{ ...subStyle, margin: 0 }}>None of the selected students are enrolled in any courses or bundles.</p>
            </div>
          )}

          {(!enrolledLoading) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

              {/* Courses column */}
              <div>
                <label style={{ ...fieldLabel, marginBottom: "8px" }}>
                  Courses {mode === "remove" && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "10px" }}>(enrolled only)</span>}
                </label>
                <input type="text" placeholder="Search courses…" value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: "8px" }} />
                <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.12)", borderRadius: "10px" }}>
                  {filteredCourses.length === 0 ? (
                    <p style={{ padding: "16px", margin: 0, color: "rgba(3,72,82,0.45)", fontSize: "13px" }}>
                      {courseSearch ? "No courses match." : mode === "remove" ? "No enrolled courses." : "No active courses."}
                    </p>
                  ) : filteredCourses.map((c) => {
                    const checked = selectedCourseIds.has(c.id);
                    return (
                      <label key={c.id} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "9px 12px", cursor: "pointer",
                        borderBottom: "1px solid rgba(3,72,82,0.05)",
                        background: checked
                          ? (mode === "assign" ? "rgba(10,190,98,0.06)" : "rgba(229,62,62,0.04)")
                          : "transparent",
                        transition: "background 100ms",
                      }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => toggleCourse(c.id)}
                          style={{ accentColor: mode === "assign" ? "#0abe62" : "#e53e3e", width: "14px", height: "14px", flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, color: "#034852", fontSize: "13px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.title}
                          </span>
                          <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                            {c.programme_type} · {c.lesson_count} lesson{c.lesson_count !== 1 ? "s" : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {selectedCourses.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                    {selectedCourses.map((c) => (
                      <span key={c.id} style={{ ...tagStyle(mode) }}>
                        {c.title}
                        <button onClick={() => toggleCourse(c.id)} style={tagRemoveBtn} title="Remove">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bundles column */}
              <div>
                <label style={{ ...fieldLabel, marginBottom: "8px" }}>
                  Bundles {mode === "remove" && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "10px" }}>(enrolled only)</span>}
                </label>
                <input type="text" placeholder="Search bundles…" value={bundleSearch}
                  onChange={(e) => setBundleSearch(e.target.value)}
                  style={{ ...inputStyle, marginBottom: "8px" }} />
                <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid rgba(3,72,82,0.12)", borderRadius: "10px" }}>
                  {filteredBundles.length === 0 ? (
                    <p style={{ padding: "16px", margin: 0, color: "rgba(3,72,82,0.45)", fontSize: "13px" }}>
                      {bundleSearch ? "No bundles match." : mode === "remove" ? "No enrolled bundles." : "No bundles available."}
                    </p>
                  ) : filteredBundles.map((b) => {
                    const checked = selectedBundleIds.has(b.id);
                    return (
                      <label key={b.id} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "9px 12px", cursor: "pointer",
                        borderBottom: "1px solid rgba(3,72,82,0.05)",
                        background: checked
                          ? (mode === "assign" ? "rgba(10,190,98,0.06)" : "rgba(229,62,62,0.04)")
                          : "transparent",
                        transition: "background 100ms",
                      }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => toggleBundle(b.id)}
                          style={{ accentColor: mode === "assign" ? "#0abe62" : "#e53e3e", width: "14px", height: "14px", flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, color: "#034852", fontSize: "13px", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b.name}
                          </span>
                          <span style={{ fontSize: "11px", color: "rgba(3,72,82,0.5)" }}>
                            {b.course_count} course{b.course_count !== 1 ? "s" : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>

                {selectedBundles.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                    {selectedBundles.map((b) => (
                      <span key={b.id} style={{ ...tagStyle(mode), background: mode === "assign" ? "rgba(3,72,82,0.07)" : "rgba(229,62,62,0.07)", borderColor: mode === "assign" ? "rgba(3,72,82,0.15)" : "rgba(229,62,62,0.2)" }}>
                        {b.name}
                        <button onClick={() => toggleBundle(b.id)} style={tagRemoveBtn} title="Remove">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary + Action button */}
          <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            {selectionSummary && (
              <span style={{ fontSize: "13px", fontWeight: 600, color: mode === "assign" ? "#209379" : "#c53030" }}>
                {selectionSummary}
              </span>
            )}
            <button onClick={() => setShowModal(true)} disabled={!canAct}
              style={{ ...primaryBtn(mode), opacity: canAct ? 1 : 0.4, cursor: canAct ? "pointer" : "not-allowed" }}>
              {mode === "assign" ? "Assign →" : "Remove →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Confirmation modal ─────────────────────────────────── */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(3,72,82,0.35)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onClick={(e) => { if (e.target === e.currentTarget && !acting) setShowModal(false); }}>
          <div style={{ background: "#fff", borderRadius: "20px", padding: "32px 36px", maxWidth: "500px", width: "100%", boxShadow: "0 8px 24px rgba(0,0,0,0.14)" }}>
            <p style={labelStyle}>
              {mode === "assign" ? "Confirm Assignment" : "Confirm Removal"}
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "rgba(3,72,82,0.7)", margin: "12px 0 6px" }}>
              You are about to {mode === "assign" ? "assign:" : "remove:"}
            </p>

            {selectedCourses.length > 0 && (
              <ul style={{ margin: "0 0 6px", paddingLeft: "20px", fontFamily: "var(--font-body)", fontSize: "14px", color: "#034852" }}>
                {selectedCourses.map((c) => <li key={c.id} style={{ fontWeight: 600 }}>{c.title}</li>)}
              </ul>
            )}
            {selectedBundles.length > 0 && (
              <ul style={{ margin: "0 0 12px", paddingLeft: "20px", fontFamily: "var(--font-body)", fontSize: "14px", color: "#034852" }}>
                {selectedBundles.map((b) => (
                  <li key={b.id}><span style={{ fontWeight: 600 }}>{b.name}</span>{" "}
                    <span style={{ fontWeight: 400, color: "rgba(3,72,82,0.45)" }}>(bundle)</span>
                  </li>
                ))}
              </ul>
            )}

            <p style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "rgba(3,72,82,0.7)", margin: "0 0 8px" }}>
              {mode === "assign" ? "to" : "from"}{" "}
              <strong style={{ color: "#034852" }}>{selectedCount} student{selectedCount !== 1 ? "s" : ""}</strong>.
            </p>
            {mode === "remove" && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#c53030", fontWeight: 600, margin: "0 0 20px" }}>
                This cannot be undone. Students not enrolled will be skipped.
              </p>
            )}
            {mode === "assign" && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "rgba(3,72,82,0.55)", margin: "0 0 20px" }}>
                Already enrolled students will be skipped. Continue?
              </p>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => !acting && setShowModal(false)} disabled={acting}
                style={{ padding: "10px 20px", borderRadius: "10px", border: "1.5px solid rgba(3,72,82,0.2)", background: "transparent", color: "#034852", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "14px", cursor: acting ? "not-allowed" : "pointer", opacity: acting ? 0.5 : 1 }}>
                Cancel
              </button>
              <button onClick={() => void handleAction()} disabled={acting}
                style={{ ...primaryBtn(mode), opacity: acting ? 0.7 : 1, cursor: acting ? "not-allowed" : "pointer" }}>
                {acting
                  ? (mode === "assign" ? "Assigning…" : "Removing…")
                  : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingShell() {
  return (
    <div style={glassCard}>
      <p style={labelStyle}>Loading</p>
      <p style={{ ...headingStyle, fontSize: "18px", marginTop: "12px" }}>Preparing Bulk Manage…</p>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const glassCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.75)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  padding: "28px 32px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.28em", color: "#209379", margin: 0,
};

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)", fontWeight: 700, color: "#034852", margin: 0,
};

const subStyle: React.CSSProperties = {
  fontSize: "14px", color: "rgba(3,72,82,0.55)", margin: "6px 0 0",
};

const fieldLabel: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700,
  color: "rgba(3,72,82,0.55)", marginBottom: "6px",
  textTransform: "uppercase", letterSpacing: "0.08em",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: "10px",
  border: "1.5px solid rgba(3,72,82,0.15)",
  background: "rgba(3,72,82,0.03)",
  fontFamily: "var(--font-body)", fontSize: "13px", color: "#034852",
  outline: "none", boxSizing: "border-box",
};

function primaryBtn(mode: Mode): React.CSSProperties {
  return {
    padding: "11px 24px", border: "none", borderRadius: "12px",
    background: mode === "assign"
      ? "linear-gradient(135deg, #0abe62 0%, #006d6c 100%)"
      : "linear-gradient(135deg, #e53e3e 0%, #c53030 100%)",
    color: "#fff", fontFamily: "var(--font-heading)", fontWeight: 700,
    fontSize: "13px", cursor: "pointer",
    boxShadow: mode === "assign"
      ? "0 6px 14px rgba(10,190,98,0.22)"
      : "0 6px 14px rgba(229,62,62,0.22)",
    display: "inline-flex", alignItems: "center",
  };
}

function tagStyle(mode: Mode): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "4px 8px 4px 10px", borderRadius: "100px",
    background: mode === "assign" ? "rgba(10,190,98,0.1)" : "rgba(229,62,62,0.08)",
    border: `1px solid ${mode === "assign" ? "rgba(10,190,98,0.25)" : "rgba(229,62,62,0.2)"}`,
    fontSize: "12px", fontWeight: 600, color: "#034852",
  };
}

const tagRemoveBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  color: "rgba(3,72,82,0.4)", fontSize: "14px", lineHeight: 1,
  padding: "0 2px", fontWeight: 700,
};

const thStyle: React.CSSProperties = {
  padding: "10px 14px", fontSize: "11px", fontWeight: 700,
  textTransform: "uppercase", letterSpacing: "0.08em",
  color: "rgba(3,72,82,0.5)",
};

const tdStyle: React.CSSProperties = {
  padding: "11px 14px", fontSize: "13px", color: "#034852",
  verticalAlign: "middle",
};
