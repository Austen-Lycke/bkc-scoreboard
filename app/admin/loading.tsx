/** Shown instantly while an admin page loads its (always fresh, uncached) data. */
export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <div className="mx-1 h-8 w-48 animate-pulse rounded-xl bg-fill" />
      <div className="h-48 animate-pulse rounded-[1.5rem] bg-fill" />
      <span className="sr-only">Laden…</span>
    </div>
  );
}
