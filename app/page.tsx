export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-gold">Brugse Katapultclub</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Wedstrijden</h1>
      <p className="max-w-xl text-lg text-muted">
        Live scores, uitslagen en het seizoensklassement per klasse. De kalender en live pagina&apos;s
        verschijnen hier zodra de eerste wedstrijd gepland is.
      </p>
    </main>
  );
}
