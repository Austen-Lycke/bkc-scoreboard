# BKC Wedstrijden

Competition scoreboard for the Brugse Katapultclub: one operator scores on a laptop at the venue
(works offline), a TV shows the live shooters and who's next, and the public follows along online.

Stack: Next.js 16 (App Router) · Neon Postgres + Drizzle · Better Auth · Vercel.

## Setup

The Vercel project (`bkc-comp-scoreboard`, team Studio Ringtail) and its Neon database are already
provisioned. All env vars, including `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`, live in Vercel:

```bash
npm install
vercel link --project bkc-comp-scoreboard   # once per machine
vercel env pull .env.local                  # DATABASE_URL, DATABASE_URL_UNPOOLED, auth vars
npm run db:migrate                          # applies lib/db/migrations (via the unpooled connection)
npm run db:seed                             # ranks, knockdown setups, current season (idempotent)
USER_PASSWORD='…' npm run create-user -- you@example.com "Your Name" admin
npm run dev
```

## Layout

- `lib/scoring/` — pure rules engine (knockdown scoring, pair schedule, standings, afkamping,
  season ranking, promotions). Used by the offline operator app and the server alike. `npm test`.
- `lib/db/` — Drizzle schema and migrations (`npm run db:generate` after schema changes).
- `lib/auth.ts` — Better Auth (email/password, roles `admin` / `operator`, no public sign-up).
- `scripts/` — seed and user management.

## Competition rules (summary)

Spanish knockdown: top row 3 · 6 · 10 · 3, bottom row 2 · 4 · 2 (30 per pass). Two knockdowns, shooters
in pairs that swap; two rounds → 4 passes per shooter (max 120). Five ranks (Junior, 3de, 2de, 1ste,
Ereklasse), each ranked separately; ties are settled by afkamping. Season ranking = sum (configurable);
the top 10 of each adult rank move up at year end.
