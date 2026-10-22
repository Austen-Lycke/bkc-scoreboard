ALTER TYPE "public"."competition_status" ADD VALUE 'semifinal';--> statement-breakpoint
ALTER TYPE "public"."competition_status" ADD VALUE 'final';--> statement-breakpoint
ALTER TABLE "shootoff_iterations" DROP CONSTRAINT "shootoff_iterations_rank_code_ranks_code_fk";
--> statement-breakpoint
ALTER TABLE "start_orders" DROP CONSTRAINT "start_orders_rank_code_ranks_code_fk";
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "format" jsonb;--> statement-breakpoint
-- WSA points as the club shoots them: variant 1 big to small 2·4·6·8·10, variant 2 five small plates of 10; typed from the scorecard.
INSERT INTO "setups" ("id", "name", "definition") VALUES ('wsa_v1', 'WSA variant 1 · groot naar klein', '{"id":"wsa_v1","name":"WSA variant 1 · groot naar klein","disciplineType":"wsa_v1","entry":"points","targets":[{"id":"plate-1","label":"80 mm","points":2,"row":1,"sizeMm":80},{"id":"plate-2","label":"70 mm","points":4,"row":1,"sizeMm":70},{"id":"plate-3","label":"60 mm","points":6,"row":1,"sizeMm":60},{"id":"plate-4","label":"50 mm","points":8,"row":1,"sizeMm":50},{"id":"plate-5","label":"40 mm","points":10,"row":1,"sizeMm":40}]}'::jsonb) ON CONFLICT ("id") DO UPDATE SET "name" = excluded."name", "definition" = excluded."definition", "updated_at" = now();--> statement-breakpoint
INSERT INTO "setups" ("id", "name", "definition") VALUES ('wsa_v2', 'WSA variant 2 · allemaal klein', '{"id":"wsa_v2","name":"WSA variant 2 · allemaal klein","disciplineType":"wsa_v2","entry":"points","targets":[{"id":"plate-1","label":"Plaat 1","points":10,"row":1,"sizeMm":40},{"id":"plate-2","label":"Plaat 2","points":10,"row":1,"sizeMm":40},{"id":"plate-3","label":"Plaat 3","points":10,"row":1,"sizeMm":40},{"id":"plate-4","label":"Plaat 4","points":10,"row":1,"sizeMm":40},{"id":"plate-5","label":"Plaat 5","points":10,"row":1,"sizeMm":40}]}'::jsonb) ON CONFLICT ("id") DO UPDATE SET "name" = excluded."name", "definition" = excluded."definition", "updated_at" = now();
