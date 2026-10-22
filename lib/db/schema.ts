import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CompetitionFormat, SeasonRule, Setup } from "@/lib/scoring";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ── Club ────────────────────────────────────────────────────────────────────

export const ranks = pgTable("ranks", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  /** 0 = lowest (Junior). Also the shooting order of the day. */
  order: integer("order").notNull(),
  isJunior: boolean("is_junior").notNull().default(false),
});

export const seasonStatus = pgEnum("season_status", ["open", "closed"]);

export const seasons = pgTable("seasons", {
  year: integer("year").primaryKey(),
  status: seasonStatus("status").notNull().default("open"),
  rankingRule: jsonb("ranking_rule").$type<SeasonRule>().notNull().default({ type: "sum" }),
  ...timestamps,
});

export const shooters = pgTable(
  "shooters",
  {
    // Client-generated so walk-ins can be created offline on the operator laptop.
    id: uuid("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    /** Optional: walk-ins registered at the table have none. */
    birthdate: date("birthdate"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("shooters_name_idx").on(t.lastName, t.firstName)],
);

export const rankReason = pgEnum("rank_reason", ["start", "junior", "promotion", "junior_age_out", "manual"]);

/** A shooter's rank is fixed for a season. */
export const shooterSeasonRanks = pgTable(
  "shooter_season_ranks",
  {
    shooterId: uuid("shooter_id")
      .notNull()
      .references(() => shooters.id, { onDelete: "cascade" }),
    seasonYear: integer("season_year")
      .notNull()
      .references(() => seasons.year),
    rankCode: text("rank_code")
      .notNull()
      .references(() => ranks.code),
    reason: rankReason("reason").notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.shooterId, t.seasonYear] })],
);

/** Reusable knockdown layouts. Competitions keep their own snapshot, so editing one never rewrites history. */
export const setups = pgTable("setups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  definition: jsonb("definition").$type<Setup>().notNull(),
  ...timestamps,
});

// ── Competitions ────────────────────────────────────────────────────────────

export const competitionStatus = pgEnum("competition_status", [
  "draft",
  "prepared",
  "warmup",
  "round1",
  "break",
  "round2",
  "shootoff",
  "finished",
  "published",
  // WSA days: the optional knockout after qualification.
  "semifinal",
  "final",
]);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    seasonYear: integer("season_year")
      .notNull()
      .references(() => seasons.year),
    name: text("name").notNull(),
    date: date("date").notNull(),
    location: text("location"),
    status: competitionStatus("status").notNull().default("draft"),
    rounds: integer("rounds").notNull().default(2),
    knockdowns: integer("knockdowns").notNull().default(2),
    feeCents: integer("fee_cents").notNull().default(0),
    countsForSeason: boolean("counts_for_season").notNull().default(true),
    /** Setup snapshot per rank code (same setup for all ranks unless overridden). */
    setupByRank: jsonb("setup_by_rank").$type<Record<string, Setup>>().notNull(),
    /** How the day is shot (lanes, series, groups, timer, knockout). Null: the Spanish day of `knockdowns`. */
    format: jsonb("format").$type<CompetitionFormat>(),
    /** The single device allowed to write scores; another laptop must explicitly take over. */
    operatorDeviceId: text("operator_device_id"),
    operatorLeaseAt: timestamp("operator_lease_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("competitions_slug_idx").on(t.slug), index("competitions_season_idx").on(t.seasonYear)],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    shooterId: uuid("shooter_id")
      .notNull()
      .references(() => shooters.id),
    /** Snapshot of the shooter's season rank at check-in. */
    rankCode: text("rank_code")
      .notNull()
      .references(() => ranks.code),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).notNull(),
    feePaid: boolean("fee_paid").notNull().default(false),
    feeCents: integer("fee_cents").notNull().default(0),
    withdrawn: boolean("withdrawn").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("entries_comp_shooter_idx").on(t.competitionId, t.shooterId)],
);

export const orderSource = pgEnum("order_source", ["reverse_ranking", "random", "manual"]);

export const startOrders = pgTable(
  "start_orders",
  {
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    /** The group: a rank code, or a group of ranks on a WSA day ("volwassenen"), so no foreign key. */
    rankCode: text("rank_code").notNull(),
    entryIds: jsonb("entry_ids").$type<string[]>().notNull(),
    source: orderSource("source").notNull(),
    seed: text("seed"),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.competitionId, t.rankCode] })],
);

/** One shooter's 7 shots on one knockdown in one round. */
export const passes = pgTable(
  "passes",
  {
    id: uuid("id").primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    knockdown: integer("knockdown").notNull(),
    hits: jsonb("hits").$type<string[]>().notNull(),
    score: integer("score").notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("passes_entry_round_kd_idx").on(t.entryId, t.round, t.knockdown),
    index("passes_competition_idx").on(t.competitionId),
  ],
);

/** One afkamping iteration within a rank. */
export const shootoffIterations = pgTable(
  "shootoff_iterations",
  {
    id: uuid("id").primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    /** The group the tie is in, like `start_orders.rank_code`. */
    rankCode: text("rank_code").notNull(),
    seq: integer("seq").notNull(),
    participants: jsonb("participants").$type<string[]>().notNull(),
    calls: jsonb("calls").$type<{ targetId: string; points: number }[]>().notNull(),
    results: jsonb("results").$type<Record<string, boolean[]>>().notNull(),
    ...timestamps,
  },
  (t) => [index("shootoffs_competition_idx").on(t.competitionId, t.rankCode)],
);

/** Raw event log from the operator device: audit trail and idempotent sync (id = client UUID). */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    clientCreatedAt: timestamp("client_created_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_competition_idx").on(t.competitionId, t.clientCreatedAt)],
);

// ── Auth (Better Auth) ──────────────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** "owner" manages everything incl. accounts; "admin" everything else; "operator" runs competitions. */
  role: text("role").notNull().default("operator"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
