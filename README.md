# BKC Wedstrijden

```
     __         __                                          KLONK!
    (  )       (  )                                           \ | /   _
     \  \     /  /                                   .---.  .---.  / /  .---.
      \  \   /  /                                    | 3 |  | 6 | /10/  | 3 |
       \  \_/  /    o  -  -  -  -  -  -  -  -  -  -  '---'  '---'/_/   '---'
        \     /                                         .---.  .---.  .---.
         |   |                                          | 2 |  | 4 |  | 2 |
         |   |                                          '---'  '---'  '---'
         |   |                                     ============================
        (_____)
```

**A competition scoreboard for slingshot shooting.** It's built for the Brugse Katapultclub (BKC),
a slingshot club in Bruges, Belgium. One operator scores on a laptop at the shooting range, a TV
next to the line shows who is shooting and who's up next, and everyone else follows the results
live at <https://bkc-comp-scoreboard.vercel.app>.

The interface is in Dutch, because that's the club's language. The code and comments are in English.

## What it's for

A club competition day has a lot of moving parts, and before this app most of them ran on paper and
a spreadsheet. The app covers the whole day:

- **Check-in.** Shooters sign in at the table, including first-timers, and pay their entry fee.
- **Start order.** It's drawn per rank in reverse season ranking (the leader shoots last). Draws are
  seeded, so they can be reproduced later.
- **Scoring.** Scores are entered from the keyboard or with big touch buttons. You can undo, and every
  correction keeps a note.
- **The TV.** It shows the shooters on the line with a 3-2-1 start signal, a series timer, a live
  scoreboard, the pause screens and a podium at the end.
- **Ties.** They're settled by *afkamping* (a shoot-off), round after round, until the tie is broken.
- **The public website.** It has a calendar, live results, shooter profiles and the season ranking.
- **The season.** Points add up over the year (as a sum or best-N, which you can configure). At year
  end the top 10 of each adult rank move up, through a promotion wizard.
- **The admin area.** Manage shooters (with CSV import), competitions, target setups, seasons and
  logins, and print score sheets and export results.

### Supported disciplines

| Discipline | Setup | Format |
| --- | --- | --- |
| **Spanish knockdown** | 7 plates: top row 3 · 6 · 10 · 3, bottom row 2 · 4 · 2 (30 per pass) | Shooters in pairs on two knockdown frames, swapping after every pass. 2 rounds, 4 passes each (max 120). |
| **WSA** | Variant 1: five plates from 80 mm to 40 mm, worth 2–10 points. Variant 2: five 40 mm plates, worth 10 each. | Up to 15 shooters at once, one frame each, with timed series. Scored from the scorecard. Optional semi-final and an elimination final. |

There are five ranks (Junior, 3de, 2de, 1ste and Ereklasse), and each is ranked on its own.

## How it works

```
   ┌────────── at the range (no internet needed) ───────────┐
   │                                                        │
   │   Operator laptop ──HDMI──▶ TV window                  │
   │   ┌──────────────────┐      (same browser, reads the   │
   │   │ event log in     │       same local database)      │
   │   │ IndexedDB        │                                 │
   │   └────────┬─────────┘                                 │
   └────────────┼───────────────────────────────────────────┘
                │ syncs when there's a connection
                ▼
         Next.js server ──▶ Postgres ──▶ public website (live results)
```

1. **Everything is an event.** Each action the operator takes (checking someone in, recording a
   pass, an afkamping, a correction) becomes an event (`lib/competition/events.ts`). The competition
   state is never stored directly. It's always rebuilt from a snapshot plus the events, and that works
   the same way on the laptop, the TV and the server.
2. **The laptop is the source of truth.** Events are saved to IndexedDB first, and the scoring screen
   never waits on the network. A service worker (`public/sw.js`) caches the operator app and the TV
   page, so a cold start works without internet too.
3. **The TV is just a second window.** The operator opens it from the app, and it goes to the
   second screen (the TV on HDMI) through the Window Management API. It reads the same local
   database, so the venue wifi can go down without the TV freezing.
4. **Syncing is best-effort and safe.** Whenever there's a connection, the laptop pushes its events
   in batches, with a heartbeat every 10 seconds. A failed sync only means "not shared yet", never
   lost data. Only one device holds a competition's **lease** at a time, and a second laptop has to
   take over on purpose.
5. **The website follows along.** While a competition runs, the public page refreshes itself every
   few seconds. Once it's finished, the results are cached.

## What makes it different

- **Offline first.** Shooting ranges have bad wifi. Here the network is an extra, not something the
  scoring depends on.
- **The log is never edited.** "Undo" doesn't delete anything. It adds new events that put the pass
  back as it was. The TV, the server and the website all follow, and you can always see afterwards
  what was changed and why.
- **One rules engine everywhere.** `lib/scoring/` is pure TypeScript with no I/O. It covers scoring,
  pair schedules, standings, afkamping, the knockout stages, season ranking and promotions. The
  offline laptop and the server run the same code, so they can't disagree.
- **Clocks that don't drift.** For timed WSA series only the start time is stored. Every screen
  works out where the countdown is from its own clock.
- **It catches typos.** It knows every score a setup can actually produce. On a WSA scorecard, a 25
  on plates worth 2·4·6·8·10 can't happen, so it gets flagged.
- **Built-in practice.** There are two demo competitions (Spanish and WSA) with fictional shooters,
  so a new operator can rehearse the whole day without touching real data.
- **It's going physical (maybe).** Research is under way into piezo sensors in the plates, which
  would detect a hit even when a plate doesn't fall. See
  [`docs/automatische-scoring-sensoren.md`](docs/automatische-scoring-sensoren.md). It's still a
  bench test and isn't part of the app yet.

## Try it

```bash
npm install
npm run dev
```

Then open <http://localhost:3000/operator/live?c=demo> (or `?c=demo-wsa`) and, in a second window,
<http://localhost:3000/tv?c=demo>. The demo runs fully in the browser, with no database and no
login. Score a few passes and watch the TV update.

## Development

**Stack:** Next.js 16 (App Router) · React 19 · Postgres on [Neon](https://neon.tech) with
[Drizzle](https://orm.drizzle.team) · [Better Auth](https://better-auth.com) · Dexie (IndexedDB) ·
Tailwind CSS 4 · Vitest and Playwright · hosted on Vercel.

> [!NOTE]
> This Next.js version has breaking changes compared to older releases. See [`AGENTS.md`](AGENTS.md).

### Environment

Copy `.env.example` and fill in:

| Variable | What |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | A random secret: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally |

Use two databases so local testing never touches live data:

- `.env.local` points at the **live** database. Next.js uses it for `next build` and `next start`.
- `.env.development.local` points at a **development** database. Next.js gives it precedence
  during `npm run dev`, and the npm scripts use it by default. They always print which database
  they're about to use.

### Database and users

```bash
npm run db:migrate          # apply migrations to the development database
npm run db:seed             # ranks, target setups and the current season
npm run db:generate         # after changing lib/db/schema.ts
```

To create a login, enter the password at a hidden prompt (zsh) so it stays out of your shell
history:

```bash
read -s "USER_PASSWORD?Password: " && export USER_PASSWORD && npm run create-user -- you@example.com "Your Name" admin; unset USER_PASSWORD
```

There are three roles. `owner` (hoofdbeheerder) also manages accounts in `/admin/gebruikers`.
`admin` (beheerder) can do everything else. `operator` runs competitions. Making someone `owner`
only happens from the command line, and if you leave out the password, only the role changes.

### Production

Pushing to `main` deploys to production, and other branches get a preview deployment. After adding
a migration, run it against the live database before or together with the deploy:

```bash
npm run db:migrate:prod
```

This first backs up every table to `backups/neondb-<time>.json` (or run `npm run db:backup:prod` on
its own), and stops if the backup fails. The backup holds members and password hashes, so it's
git-ignored and stays on your machine. The `:prod` variants of the seed and create-user scripts
work the same way.

### Tests

```bash
npm test                    # the rules engine and competition logic (Vitest)
npm run test:db             # sync against a real database
npm run test:e2e            # browser tests on the demo (operator → TV, undo, touch sizes)
npm run typecheck && npm run lint
```

The e2e tests run on a laptop and a tablet viewport. They start (or reuse) `npm run dev` and need no
database or login. Run `npx playwright install chromium` once before the first run.

## Project layout

| Path | What's inside |
| --- | --- |
| `lib/scoring/` | The pure rules engine: disciplines, setups, ranks, start order, standings, afkamping, knockout, season and promotion |
| `lib/competition/` | Events, state rebuilding, undo, timers, the demo competitions, exports |
| `lib/offline/` | IndexedDB, sync, the service worker registration, opening the TV window |
| `lib/server/` | Server-side sync, snapshots, public data, access checks |
| `lib/db/` | The Drizzle schema and migrations |
| `lib/auth.ts` | Better Auth (email and password, no public sign-up) |
| `app/operator/` | The operator app (check-in, order, scoring, afkamping, close) |
| `app/tv/` | The venue TV screen |
| `app/(public)/` | The public website (calendar, competitions, shooters, season ranking) |
| `app/admin/` | The admin area |
| `scripts/` | Seed, backup and user management |
| `e2e/` | Playwright tests |
| `docs/` | Research notes |
