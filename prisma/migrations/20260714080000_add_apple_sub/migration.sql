-- Sign in with Apple : identifiant stable (claim sub) par utilisateur.
ALTER TABLE "users" ADD COLUMN "apple_sub" TEXT;
CREATE UNIQUE INDEX "users_apple_sub_key" ON "users"("apple_sub");
