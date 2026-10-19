import Link from "next/link";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-[0.2em] text-gold">BKC</span>
            <span className="font-medium text-white/85">Wedstrijden</span>
          </Link>
          <nav className="flex gap-5 text-sm font-medium text-white/80">
            <Link href="/kalender" className="hover:text-white">
              Kalender
            </Link>
            <Link href="/klassement" className="hover:text-white">
              Klassement
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-2 px-4 py-6 text-sm text-muted sm:px-6">
          <span>Brugse Katapultclub</span>
          <Link href="/operator" className="hover:text-foreground">
            Wedstrijdleiding
          </Link>
        </div>
      </footer>
    </>
  );
}
