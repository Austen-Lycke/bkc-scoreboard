import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 px-6 py-24">
      <h1 className="text-2xl font-semibold">Geen toegang</h1>
      <p className="text-muted">Je account heeft geen rechten voor deze pagina.</p>
      <Link href="/" className="text-gold underline underline-offset-4">
        Naar de startpagina
      </Link>
    </main>
  );
}
