-- AlterTable
ALTER TABLE "days" ALTER COLUMN "morning_score" DROP NOT NULL,
ALTER COLUMN "afternoon_score" DROP NOT NULL,
ALTER COLUMN "evening_score" DROP NOT NULL,
ALTER COLUMN "extra_score" DROP NOT NULL;
