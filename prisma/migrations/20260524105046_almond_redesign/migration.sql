-- Almond Wellness redesign migration.
-- Drops the existing Score enum & rebuilds the days table with 5 levels +
-- snack/sport_type fields. The user is the only consumer and accepted
-- losing historical data.

-- Drop dependent table & old enum
DROP TABLE IF EXISTS "days" CASCADE;
DROP TYPE  IF EXISTS "Score";

-- Recreate Score enum with 5 values mapped to canonical kebab-case codes
CREATE TYPE "Score" AS ENUM ('tres-leger', 'leger', 'normal', 'copieux', 'tres-copieux');

-- Recreate days table
CREATE TABLE "days" (
  "id"              SERIAL PRIMARY KEY,
  "user_id"         INTEGER NOT NULL,
  "morning_score"   "Score",
  "afternoon_score" "Score",
  "evening_score"   "Score",
  "snack"           DOUBLE PRECISION,
  "sport"           BOOLEAN NOT NULL DEFAULT false,
  "sport_type"      TEXT,
  "date"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "days_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "days_user_id_idx" ON "days"("user_id");
