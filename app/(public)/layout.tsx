import Link from "next/link";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[75rem] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-[0.2em] hover:no-underline">
            BKC
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-1 text-base text-muted">
            <Link href="/" className="flex items-center gap-2 font-semibold text-ink hover:underline">
              <span className="size-2 rounded-full bg-live" />
              Live
            </Link>
            <Link href="/kalender" className="hover:text-ink hover:underline">
              Kalender
            </Link>
            <Link href="/klassement" className="hover:text-ink hover:underline">
              Klassement
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[75rem] flex-1 px-6 pb-12 pt-8">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[75rem] flex-wrap justify-between gap-x-6 gap-y-2 px-6 py-5 text-[0.8125rem] text-subtle">
          <span>De scores worden live doorgegeven door de wedstrijdleiding.</span>
          <span>
            Brugse Katapultclub ·{" "}
            <Link href="/operator" className="hover:text-ink hover:underline">
              Wedstrijdleiding
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}
