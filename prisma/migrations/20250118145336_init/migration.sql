-- CreateEnum
CREATE TYPE "Score" AS ENUM ('0', '1', '2', '3');

-- CreateTable
CREATE TABLE "days" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "morning_score" "Score" NOT NULL DEFAULT '0',
    "afternoon_score" "Score" NOT NULL DEFAULT '0',
    "evening_score" "Score" NOT NULL DEFAULT '0',
    "extra_score" "Score" NOT NULL DEFAULT '0',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "days_pkey" PRIMARY KEY ("id")
);
