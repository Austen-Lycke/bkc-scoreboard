# BKC Wedstrijden

Competition scoreboard for the Brugse Katapultclub: one operator scores on a laptop at the venue
(works offline), a TV shows the live shooters and who's next, and the public follows along online.

Stack: Next.js 16 (App Router) · Neon Postgres + Drizzle · Better Auth · Vercel.

## Setup

Hosting: Vercel project `bkc-comp-scoreboard` (team Studio Ringtail), live at
https://bkc-comp-scoreboard.vercel.app. Pushing to `main` on GitHub deploys to production; other
branches get a preview deployment.

```bash
npm install
vercel link --project bkc-comp-scoreboard   # once per machine
vercel env pull .env.local                  # live DATABASE_URL + auth vars
```

### Two databases

Both live in the same Neon project (Frankfurt):

| Database | Used by | Env file |
| --- | --- | --- |
| `neondb` (live) | the website on Vercel, `next build` / `next start` | `.env.local` (from `vercel env pull`) |
| `bkc_dev` | `npm run dev` and the npm db/user scripts | `.env.development.local` (local only) |

`.env.development.local` holds the `bkc_dev` connection strings (same host and user, database
`bkc_dev`). Next.js gives it precedence over `.env.local` in development, so local testing never
touches live data. The scripts print which database they use.

```bash
npm run db:migrate          # development database
npm run db:seed
read -s "USER_PASSWORD?Password: " && export USER_PASSWORD && npm run create-user -- you@example.com "Your Name" admin; unset USER_PASSWORD
npm run dev

npm run db:migrate:prod     # live database: run after adding a migration, before/with the deploy
```

Admins can also manage accounts in `/admin/gebruikers`.

## Layout

- `lib/scoring/` — pure rules engine (knockdown scoring, pair schedule, standings, afkamping,
  season ranking, promotions). Used by the offline operator app and the server alike. `npm test`.
- `lib/db/` — Drizzle schema and migrations (`npm run db:generate` after schema changes).
- `lib/auth.ts` — Better Auth (email/password, roles `admin` / `operator`, no public sign-up).
- `lib/offline/`, `app/operator/live`, `app/tv` — the offline operator app and the venue TV (IndexedDB,
  service worker in `public/sw.js`, sync to the server).
- `app/(public)` — the public website; `app/admin` — the admin area.
- `scripts/` — seed and user management.

## Competition rules (summary)

Spanish knockdown: top row 3 · 6 · 10 · 3, bottom row 2 · 4 · 2 (30 per pass). Two knockdowns, shooters
in pairs that swap; two rounds → 4 passes per shooter (max 120). Five ranks (Junior, 3de, 2de, 1ste,
Ereklasse), each ranked separately; ties are settled by afkamping. Season ranking = sum (configurable);
the top 10 of each adult rank move up at year end.
