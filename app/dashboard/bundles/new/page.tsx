"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "../../_components/catalogue.module.css";
import bundleStyles from "../bundles.module.css";
import { BackLink } from "@/components/back-link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePermissions } from "@/hooks/use-permission";
import { PERM } from "@/lib/permissions";
import { createBundle } from "@/lib/api";
import { useInvalidate } from "@/lib/mutations/invalidation";

export default function NewBundlePage() {
  const router = useRouter();
  const invalidate = useInvalidate();
  const { isLoading } = useCurrentUser();
  const { has, isLoading: permLoading } = usePermissions();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || permLoading) return <p role="status">Loading…</p>;

  if (!has(PERM.bundles.create)) {
    return <section className={styles.empty}><h1>You don’t have permission to create bundles.</h1><BackLink fallback="/dashboard/bundles" className={styles.secondary}>Back to Bundles</BackLink></section>;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Bundle name is required."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const bundle = await createBundle({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      invalidate('bundles');
      router.replace(`/dashboard/bundles/${bundle.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bundle.");
      setSubmitting(false);
    }
  }

  return <div className={`${styles.catalogue} ${bundleStyles.form}`}>
    <div><BackLink fallback="/dashboard/bundles" className={styles.secondary}><ArrowLeft size={16} aria-hidden="true" />Back to Bundles</BackLink></div>
    <form onSubmit={event => void handleCreate(event)} className={bundleStyles.formPanel}>
      <label className={styles.field}>Bundle name
        <input autoFocus required value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Foundation year" className={styles.control} />
      </label>
      <label className={styles.field}>Description <span className="sr-only">(optional)</span>
        <textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="What will students learn in this bundle?" rows={4} className={styles.control} />
      </label>
      <p className={styles.resultsLabel}>You can add courses and quizzes after creating the bundle.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className={bundleStyles.formActions}>
        <Link href="/dashboard/bundles" className={styles.secondary}>Cancel</Link>
        <button type="submit" disabled={submitting || !name.trim()} className={`${styles.primary} disabled:opacity-50 disabled:cursor-not-allowed`}>{submitting ? "Creating…" : "Create bundle"}<ArrowRight size={16} className="hidden sm:block" aria-hidden="true" /></button>
      </div>
    </form>
  </div>;
}
