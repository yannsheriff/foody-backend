-- AlterTable
ALTER TABLE "days" ADD COLUMN     "cheat_slot" TEXT;

-- CreateTable
CREATE TABLE "coin_transactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freeze_consumptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "freeze_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coin_transactions_user_id_idx" ON "coin_transactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coin_transactions_user_id_reason_ref_key" ON "coin_transactions"("user_id", "reason", "ref");

-- CreateIndex
CREATE INDEX "freeze_consumptions_user_id_idx" ON "freeze_consumptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "freeze_consumptions_user_id_day_key" ON "freeze_consumptions"("user_id", "day");

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freeze_consumptions" ADD CONSTRAINT "freeze_consumptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

