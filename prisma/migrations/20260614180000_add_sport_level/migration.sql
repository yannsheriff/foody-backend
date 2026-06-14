-- CreateEnum
CREATE TYPE "SportLevel" AS ENUM ('none', 'normal', 'intense');

-- AlterTable
ALTER TABLE "days" ADD COLUMN "sport_level" "SportLevel";

-- Backfill: existing "sport = true" days become a normal session; days left at
-- the boolean default (false) stay NULL = "not answered yet" rather than an
-- explicit repos. The legacy "sport" boolean is kept and mirrored on write.
UPDATE "days" SET "sport_level" = 'normal' WHERE "sport" = true;
