-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('active', 'completed', 'abandoned');

-- CreateTable
CREATE TABLE "user_challenges" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "user_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_challenges_user_id_idx" ON "user_challenges"("user_id");

-- AddForeignKey
ALTER TABLE "user_challenges" ADD CONSTRAINT "user_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One active challenge per user, enforced at the DB level (the service
-- pre-checks to return a clean 409; this index backstops races).
CREATE UNIQUE INDEX "user_challenges_one_active" ON "user_challenges"("user_id") WHERE "status" = 'active';
