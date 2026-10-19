/** Shown instantly while an admin page loads its (always fresh, uncached) data. */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-black/5 dark:bg-white/10" />
      <div className="h-40 animate-pulse rounded-xl bg-black/5 dark:bg-white/10" />
      <span className="sr-only">Laden…</span>
    </div>
  );
}
