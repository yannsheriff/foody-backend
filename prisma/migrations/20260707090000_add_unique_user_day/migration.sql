-- Un seul enregistrement "days" par utilisateur et par jour calendaire (UTC).
-- Garde-fou contre les doublons créés par un POST /days concurrent d'un
-- GET /days/user/:id/today (le calendrier affichait alors la ligne vide).
-- "date" est un TIMESTAMP sans timezone : date_trunc y est IMMUTABLE, donc
-- indexable. Comme user_challenges_one_active, cet index vit uniquement en SQL
-- (non exprimable dans schema.prisma).
CREATE UNIQUE INDEX "days_one_per_user_day" ON "days" ("user_id", date_trunc('day', "date"));
