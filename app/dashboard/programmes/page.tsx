"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderKanban, Plus, RefreshCw, Search, X } from "lucide-react";
import { usePermissions } from "@/hooks/use-permission";
import { HeaderActions } from "@/components/dashboard/HeaderActions";
import { PERM } from "@/lib/permissions";
import { useProgrammes } from "@/lib/queries/programmes";
import { useCreateProgramme } from "@/lib/mutations/programmes";
import { ApiError } from "@/lib/api";
import { PROGRAMME_KINDS } from "@/lib/programme-kinds";
import { withFrom } from "@/lib/nav";
import { useCurrentUrl } from "@/lib/useCurrentUrl";
import cat from "../_components/catalogue.module.css";
import s from "./programmes.module.css";

/** Slug a display name into the A-Z0-9_ shape the API requires. */
function suggestCode(name: string, state: string): string {
  return [name, state]
    .filter(Boolean)
    .join("_")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export default function ProgrammesPage() {
  const { has } = usePermissions();
  const canCreate = has(PERM.programmes.create);
  const currentUrl = useCurrentUrl();

  const [includeArchived, setIncludeArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  const { data: programmes = [], isLoading, error, refetch, isFetching } = useProgrammes(includeArchived);
  const term = search.trim().toLocaleLowerCase();
  const visible = term
    ? programmes.filter((p) => [p.name, p.code, p.kind, p.state, p.cohort_label].filter(Boolean).join(" ").toLocaleLowerCase().includes(term))
    : programmes;

  return (
    <div className={`${cat.catalogue} ${s.page}`}>
      {canCreate && (
        <HeaderActions>
          <button type="button" className={cat.primary} onClick={() => setShowCreate(true)}>
            <Plus size={18} aria-hidden="true" />New programme
          </button>
        </HeaderActions>
      )}

      <div className={cat.toolbar}>
        <label className={cat.search}>
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label="Search programmes" placeholder="Search by name, code or state…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <div className={s.toolbarEnd}>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>
      </div>

      <p role="status" className={cat.resultsLabel}>
        {isLoading ? "Loading programmes…" : error ? "Programmes unavailable" : `${visible.length} ${visible.length === 1 ? "programme" : "programmes"}${term ? " match" : ""}`}
      </p>

      {isLoading ? (
        <div aria-label="Loading programmes" className={cat.skeleton} style={{ minHeight: "12rem" }}><div /><div /><div /></div>
      ) : error ? (
        <section role="alert" className={cat.empty}>
          <FolderKanban size={28} aria-hidden="true" />
          <h2>Programmes couldn’t be loaded</h2>
          <p>{error instanceof ApiError ? error.message : "Failed to load programmes."}</p>
          <button type="button" className={cat.secondary} disabled={isFetching} onClick={() => void refetch()}>
            <RefreshCw size={16} aria-hidden="true" />{isFetching ? "Retrying…" : "Try again"}
          </button>
        </section>
      ) : visible.length === 0 ? (
        <section className={cat.empty}>
          <FolderKanban size={28} aria-hidden="true" />
          <h2>{term ? "No matching programmes" : "No programmes yet."}</h2>
          <p>{term ? "Try another name or clear your search." : canCreate ? "Create one to get started." : "Programmes you can see will appear here."}</p>
          {term
            ? <button type="button" className={cat.secondary} onClick={() => setSearch("")}>Clear search</button>
            : canCreate && <button type="button" className={cat.primary} onClick={() => setShowCreate(true)}><Plus size={16} aria-hidden="true" />New programme</button>}
        </section>
      ) : (
        <div className={cat.tableWrap}>
          <table className={cat.table}>
            <thead>
              <tr>{["Programme", "Kind", "Code", "State", "Status", "Membership"].map((h) => <th key={h} scope="col">{h}</th>)}</tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={withFrom(`/dashboard/programmes/${p.id}`, currentUrl)} className={cat.courseTitle}>{p.name}</Link>
                    {p.cohort_label && <span className={cat.tableDescription}>{p.cohort_label}</span>}
                  </td>
                  <td>{p.kind}</td>
                  <td><span className={s.code}>{p.code}</span></td>
                  <td>{p.state ?? <span style={{ color: "var(--color-text-muted)" }}>—</span>}</td>
                  <td>{p.status === "ARCHIVED"
                    ? <span className={`${s.pill} ${s.pillMuted}`}>Archived</span>
                    : <span className={`${s.pill} ${s.pillGreen}`}>Active</span>}</td>
                  <td>{p.is_member
                    ? <span className={`${s.pill} ${s.pillInfo}`}>Member</span>
                    : <span style={{ color: "var(--color-text-muted)" }}>Not a member</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateProgrammeModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateProgrammeModal({ onClose }: { onClose: () => void }) {
  const create = useCreateProgramme();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("UG");
  const [state, setState] = useState("");
  const [code, setCode] = useState("");
  const [cohort, setCohort] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const effectiveCode = code.trim() || suggestCode(name, state);

  async function submit() {
    setErr(null);
    try {
      await create.mutateAsync({
        code: effectiveCode,
        name: name.trim(),
        kind: kind.trim(),
        state: state.trim() || undefined,
        cohort_label: cohort.trim() || undefined,
      });
      onClose();
    } catch (e) {
      // Surface the server's words: it distinguishes a duplicate code (409)
      // from a malformed one (400), and the fix differs.
      setErr(e instanceof ApiError ? e.message : "Failed to create programme.");
    }
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-programme-title"
        className={s.dialog}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        <div className={s.dialogHead}>
          <h2 id="new-programme-title">New programme</h2>
          <button type="button" className={s.iconButton} aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>
        <p className={s.help} style={{ fontSize: "0.8125rem" }}>
          A programme is a track in a place — “UG Kerala”, “CAT Kerala”. You become its
          first owner.
        </p>

        <div>
          <label className={s.label} htmlFor="programme-name">Name</label>
          <input id="programme-name" className={cat.control} value={name} onChange={(e) => setName(e.target.value)} placeholder="UG Kerala" />
        </div>

        <div className={s.twoCol}>
          <div>
            <label className={s.label} htmlFor="programme-kind">Kind</label>
            {/* A dropdown, not free text: kind is immutable after create, and
                every other form in the app validates against this same list.
                Typing "NEET" here used to create a programme that no course,
                batch or user could then be given. */}
            <select id="programme-kind" className={cat.control} value={kind} onChange={(e) => setKind(e.target.value)}>
              {PROGRAMME_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={s.label} htmlFor="programme-state">State</label>
            <input id="programme-state" className={cat.control} value={state} onChange={(e) => setState(e.target.value)} placeholder="KERALA" />
          </div>
        </div>

        <div>
          <label className={s.label} htmlFor="programme-code">Code</label>
          <input
            id="programme-code"
            className={`${cat.control} ${s.code}`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={effectiveCode || "UG_KERALA"}
          />
          <div className={s.help} style={{ marginTop: 6 }}>
            Letters, digits and underscores. Permanent once set — leave blank to use{" "}
            <code>{effectiveCode || "…"}</code>.
          </div>
        </div>

        <div>
          <label className={s.label} htmlFor="programme-cohort">Cohort label (optional)</label>
          <input id="programme-cohort" className={cat.control} value={cohort} onChange={(e) => setCohort(e.target.value)} placeholder="AY 2026" />
        </div>

        {err && <div role="alert" className={s.error}>{err}</div>}

        <div className={s.actionsRow}>
          <button type="button" className={cat.secondary} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={cat.primary}
            disabled={create.isPending || !name.trim() || !effectiveCode}
            onClick={submit}
          >
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
