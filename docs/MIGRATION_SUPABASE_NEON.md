# Migration Supabase → Neon

Objectif : quitter Supabase (base **et** authentification) sans perte de données, sans que les utilisateurs aient à changer de mot de passe.

## Principe

L'application dépend aujourd'hui de Supabase de deux façons :

1. **Authentification** : `supabase.auth.*`. ✅ Remplacée par Better Auth sur la branche de migration.
2. **Accès aux données depuis le navigateur** : environ 70 appels `supabase.from(...)` avec la clé anon, dans les pages et composants.

Les tables de Better Auth ne peuvent pas être ajoutées à la base Supabase par les migrations Drizzle : les migrations `0002` et `0003` ne doivent jamais y tourner. Tout le travail se fait donc sur la branche de migration, testée sur Neon `dev`. La production bascule **en une seule fois** : copie des données, import des comptes, déploiement.

```
Étape 0  Fondations : tests, schéma, outils                 ✅
Étape 1  Inventaire du schéma réel de Supabase               ✅
Étape 2  Authentification Better Auth (code + tests)         ✅
Étape 3  Accès aux données côté serveur (Drizzle + session)
Étape 4  Répétition générale sur un déploiement preview Vercel + Neon dev
Étape 5  Bascule de la production
Étape 6  Nettoyage
```

`main` reste sur Supabase jusqu'à l'étape 5. Chaque étape est validée par la CI : typecheck, tests, build.

---

## Projet Neon

| | |
|---|---|
| Projet | `round-hat-77068788` (« Home budget tracker »), org `org-muddy-queen-99619406` |
| Région | `aws-us-east-2`, Postgres 18 |
| Branches | `production` (défaut, **vide** : réservée à l'import des vraies données) · `dev` (tests, expire au bout de 7 jours, recréable avec `neon checkout dev --create`) |
| Driver | `pg` + `attachDatabasePool` (`@vercel/functions`), comme le recommande Neon pour Vercel |
| Migrations | `npm run db:migrate` (connexion directe `DATABASE_URL_UNPOOLED`) |
| Santé | `GET /api/health/db` avec `Authorization: Bearer $CRON_SECRET` |

`neon env pull` écrit `DATABASE_URL` et `DATABASE_URL_UNPOOLED` dans `.env.local` pour la branche active (`neon checkout <branche>`).

> Neon Auth (géré) est encore déclaré dans `neon.ts` (`auth: true`) mais **n'est pas utilisé** : l'app embarque Better Auth. À retirer de `neon.ts` puis `neon deploy` pour le désactiver.

## Étape 0 — Fondations ✅

| Élément | Fichier |
|---|---|
| Schéma Drizzle complet (tables créées à la main dans Supabase incluses) | `src/db/schema/index.ts`, migrations `0002`, `0003` |
| Client Drizzle | `src/lib/db.ts` |
| Tests unitaires + Postgres en mémoire (PGlite) | `tests/`, `vitest.config.mts` |
| Comparaison de deux bases (colonnes, nombre de lignes, checksum) | `npm run migration:compare` |
| CI GitHub Actions | `.github/workflows/ci.yml` |

> ⚠️ Les migrations Drizzle ne servent qu'à créer une base neuve (Neon, tests). Elles ne doivent **jamais** être appliquées sur Supabase.

## Étape 1 — Inventaire du schéma réel ✅

Le 20/11, en lecture seule via l'API Supabase : schéma **identique** à Neon après `0002` et `0003`. Ça fait 9 tables et 62 colonnes, avec les mêmes types et la même nullabilité, et aucune fonction RPC.

Volumes :
- 4 utilisateurs, tous confirmés, chacun avec sa ligne `users` ;
- 1 foyer ;
- 96 dépenses, dont 14 supprimées ;
- 2 rapports mensuels.

## Étape 2 — Authentification Better Auth ✅

| Élément | Fichier |
|---|---|
| Configuration serveur (factory testable + instance de l'app) | `src/lib/auth.ts` |
| Endpoints `/api/auth/*` | `src/app/api/auth/[...all]/route.ts` |
| Client navigateur, hook `useAuth` (même interface qu'avant) | `src/lib/auth-client.ts`, `src/hooks/useAuth.ts` |
| Session côté serveur (pour l'étape 3) | `src/lib/session.ts` (`getSession`, `requireUser`) |
| Redirection vers `/login?next=…` sans cookie de session | `src/middleware.ts` |
| Email de réinitialisation (Gmail SMTP existant) | `src/services/email/resetPasswordEmail.ts` |
| Tables `sessions`, `accounts`, `verifications` ; `users.email_verified`, `users.image` | migration `0004_better_auth.sql` |
| Import des comptes Supabase | `npm run migration:import-auth` |

Choix :
- **Une seule table d'utilisateurs** : le modèle `user` de Better Auth est la table `users` de l'app (`name` ↔ `display_name`). Les identifiants restent ceux de Supabase.
- **Mots de passe** : les nouveaux sont hachés en scrypt (défaut de Better Auth). Les hash **bcrypt importés de Supabase restent valides**. Une réinitialisation remplace le bcrypt par un scrypt.
- **Longueur minimale de 6 caractères**, comme Supabase, pour que les mots de passe existants restent acceptés.
- **Réinitialisation du mot de passe** : lien valable 1 h, à usage unique. Elle déconnecte les autres sessions.
- **Pas de vérification d'email à l'inscription**, comme avant. Les comptes importés gardent leur état « confirmé ».

Tests :
- 12 tests d'auth sur PGlite : inscription, connexion, session, déconnexion, compte importé avec bcrypt et mot de passe de 6 caractères, import idempotent, cas d'erreur, réinitialisation.
- Test de bout en bout dans l'app réelle (Postgres 16 + Playwright + SMTP local) :
  - redirection `?next` ;
  - connexion d'un compte importé avec son mot de passe Supabase ;
  - rechargement de la page ;
  - bouton de déconnexion ;
  - inscription ;
  - parcours complet « mot de passe oublié » (email, lien, nouveau mot de passe, ancien refusé, lien réutilisé refusé).

## Étape 3 — Accès aux données côté serveur

Remplacer chaque `supabase.from(...)` par une fonction serveur Drizzle (server actions), qui :

- lit l'utilisateur avec `requireUser()`, jamais depuis un paramètre envoyé par le client ;
- vérifie que l'utilisateur est membre du foyer concerné, puisque la RLS est désactivée aujourd'hui.

Ordre, un commit par domaine :

1. foyers et membres (liste, détail, création, suppression, renommage, code d'adhésion) ;
2. demandes d'adhésion ;
3. dépenses (liste, création, modification, suppression, duplication) et tableau de bord ;
4. profils (`user_profiles`) ;
5. rapport mensuel (la route cron passe de supabase-js à Drizzle).

**Tests** : chaque fonction est testée sur PGlite, règles d'accès comprises (un non-membre est refusé).

## Étape 4 — Répétition générale (preview Vercel + Neon `dev`)

1. Dans Vercel, ajouter des variables pour l'environnement **Preview** uniquement :
   - `DATABASE_URL` : chaîne pooled de Neon `dev` ;
   - `BETTER_AUTH_SECRET` ;
   - les variables SMTP.

   Sans `BETTER_AUTH_URL`, l'URL de la preview est utilisée.
2. Copier les vraies données dans Neon `dev` (procédure de l'étape 5, sans la maintenance), importer les comptes, puis `migration:compare`.
3. Tester la preview avec un vrai compte : connexion avec le mot de passe actuel, foyer, dépenses, rapport mensuel (`dryRun`), `/api/health/db`.

## Étape 5 — Bascule de la production

Pré-requis : `psql` et `pg_dump` (version ≥ 17) sur ta machine, et les chaînes de connexion Supabase (directe) et Neon `production` (directe et pooled).

1. **Schéma** : `DATABASE_URL_UNPOOLED=<neon production direct> npm run db:migrate`.
2. **Maintenance** : plus aucune écriture sur l'app.
3. **Données** :
   `pg_dump "$SUPABASE_DB_URL" --data-only --schema=public --exclude-table='__drizzle*' | psql "$NEON_DB_URL_UNPOOLED"`
4. **Vérification** : `SOURCE_DATABASE_URL=<supabase> TARGET_DATABASE_URL=<neon direct> npm run migration:compare` doit afficher « All tables match ». Les colonnes Better Auth de `users` sont ignorées.
5. **Comptes** : exporter `auth.users` depuis l'éditeur SQL de Supabase (requête en tête de `scripts/migration/import-supabase-auth.ts`), puis :
   `DATABASE_URL_UNPOOLED=<neon direct> npm run migration:import-auth -- supabase-auth-users.json`
   Le résultat attendu est « Imported: 4 ». **Supprimer ensuite le fichier**, qui contient les hash.
6. **Vercel (Production)** :
   - `DATABASE_URL` : Neon pooled ;
   - `BETTER_AUTH_SECRET` ;
   - `BETTER_AUTH_URL=https://hbt-beryl.vercel.app`.
7. **Déploiement** : merge de la branche de migration dans `main`.
8. **Contrôles** :
   - `/api/health/db` ;
   - connexion avec un vrai compte, avec le même mot de passe ;
   - foyer et dépenses visibles ;
   - rapport mensuel en `dryRun`.

Les utilisateurs se reconnectent **une fois** (nouvelle session), avec le même email et le même mot de passe.
**Retour arrière** : revert du merge et ancienne `DATABASE_URL`. Supabase n'a pas été modifié.

## Étape 6 — Nettoyage

- Supprimer `@supabase/supabase-js`, `src/lib/supabase/` et les variables `SUPABASE_*`.
- Retirer Neon Auth de `neon.ts`.
- Garder le projet Supabase en lecture seule 2 à 4 semaines, puis le supprimer.
