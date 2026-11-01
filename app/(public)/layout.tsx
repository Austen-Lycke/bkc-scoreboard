import Link from "next/link";
import { SiteHeader } from "@/components/public/site-header";

/**
 * The public website, in the TV screen's language (designer's "BKC Website" handoff). Sizes scale
 * with the page width (cqw), the same on a phone and on a desktop; below md a phone shows less text
 * on purpose (docs: MOBILE.md in the handoff).
 */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="@container flex min-h-full flex-1 flex-col tabular-nums">
      <SiteHeader />
      <main className="mx-auto box-border w-full max-w-[75rem] flex-1 px-[clamp(1rem,4cqw,2.5rem)] pb-[clamp(3rem,6cqw,5rem)] pt-[clamp(1.5rem,4cqw,3.5rem)]">
        {children}
      </main>
      <footer className="border-t-2 border-border">
        <div className="mx-auto box-border flex max-w-[75rem] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-[clamp(1rem,4cqw,2.5rem)] py-4 text-[0.9375rem] text-muted">
          <span className="py-2 max-md:hidden">De scores worden live doorgegeven door de wedstrijdleiding.</span>
          <span className="flex items-center gap-1.5">
            Brugse Katapultclub ·
            <Link
              href="/operator"
              className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-yellow decoration-2 underline-offset-4 hover:decoration-ink"
            >
              Wedstrijdleiding
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
