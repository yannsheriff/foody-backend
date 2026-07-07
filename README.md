# Foody Backend

API REST du journal bien-être Foody — NestJS 10 + Prisma + PostgreSQL (Neon), JWT, déployée en serverless sur Vercel.

Prod : https://foody-backend-two.vercel.app — Swagger sur `/api`.

## Commandes

```bash
yarn start:dev    # nest start --watch (PORT ou :3000)
yarn build        # nest build
yarn lint         # eslint --fix
yarn test         # jest
yarn test:e2e     # jest --config ./test/jest-e2e.json

# Prisma
npx prisma migrate dev --name <name>   # migration locale
npx prisma migrate deploy              # appliquer en prod (safe)
npx prisma studio                      # GUI DB
```

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Postgres Neon (aussi dans les env Vercel — le `.env` local n'est jamais uploadé) |
| `JWT_SECRET` | Secret JWT — ⚠️ fallback `"secretKey"` si absent, à toujours définir en prod |
| `CRON_SECRET` | Protège l'endpoint du cron de rappels push |

## Repères d'architecture

- **Modules** : `users`, `auth`, `days`, `insights` (streak/records/badges/stats, tout dérivé de `days`), `challenges` (défis à niveaux, catalogue en code).
- **Scoring** : `src/insights/insights.scoring.ts` (`computeDayScore`, plafonné à 10). ⚠️ Dupliqué côté frontend (`foody/src/utils/day-score.ts`) — toute modif se fait **des deux côtés dans la même PR**.
- **Enum `Score`** : kebab-case sur le wire (`tres-leger`), camelCase côté Prisma. Tout endpoint qui touche cet enum passe par `src/days/score-mapper.ts`, sinon les valeurs `tres-*` échouent silencieusement.
- **Un jour par utilisateur** : index unique `days_one_per_user_day` sur `(user_id, date_trunc('day', date))` ; `POST /days` est idempotent (fusion si la journée existe déjà).
- **Règle de flamme** : `meals_completed_at` est stampé côté serveur uniquement et jamais exposé au client ; un jour complété après J+1 23h30 ne compte pas pour la flamme (« une flamme perdue est perdue »). Détails dans le `CLAUDE.md` du workspace parent.
- **Autorisation** : routes `days` sous `JwtAuthGuard` + `UserGuard` (le `userId` du path/body doit matcher le JWT) ; routes `/me/*` sous `JwtAuthGuard` seul (elles lisent `req.user.id`).

## Déploiement (⚠️ spécificités Vercel)

- Push sur `main` → GitHub Actions (`.github/workflows/deploy.yml`) → Vercel. L'intégration Git native n'est **pas** branchée.
- `vercel.json` sert un **`dist/main.js` prébuilt** : le workflow doit faire `yarn build` avant `vercel deploy --prod`. Sans `dist/` frais, chaque route répond 404. Déploiement manuel : `yarn build && vercel deploy --prod`.
- `src/main.ts` exporte un handler par défaut (ExpressAdapter, `app.listen()` sauté quand `VERCEL` est set) — ne pas revenir au pattern `bootstrap()` classique, `@vercel/node` exige un default export.
- Migrations : `npx prisma migrate deploy` depuis une machine avec le bon `DATABASE_URL` (pas d'intégration Neon-Vercel).
