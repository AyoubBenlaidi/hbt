# Migration Supabase → Neon

Objectif : quitter Supabase (base **et** authentification) sans perte de données, en petites étapes déployables et réversibles.

## Principe

L'application dépend aujourd'hui de Supabase de deux façons :

1. **Accès aux données depuis le navigateur** : environ 70 appels `supabase.from(...)` avec la clé anon, dans les pages et composants.
2. **Authentification** : `supabase.auth.*` (`useAuth`, `modules/auth`, page de réinitialisation du mot de passe).

On les retire **avant** de déplacer la base. Le code passe par Drizzle avec `DATABASE_URL`, qui pointe d'abord vers le Postgres de Supabase. Le jour du déménagement, la bascule vers Neon se limite alors à copier les données et à changer `DATABASE_URL`.

```
Étape 0  Fondations : tests, schéma, outils          ✅ fait
Étape 1  Inventaire du schéma réel de Supabase        ✅ fait
Étape 2  Accès aux données côté serveur (Drizzle)     ← toujours sur la base Supabase
Étape 3  Authentification (code + tests)              ← choix Neon Auth / Better Auth à faire
Étape 4  Bascule de l'authentification (prod)         ← toujours sur la base Supabase
Étape 5  Bascule de la base vers Neon (prod)
Étape 6  Nettoyage
```

Chaque étape se termine par une PR verte (CI : typecheck, tests, build).

---

## Étape 0 — Fondations ✅

| Élément | Fichier |
|---|---|
| Schéma Drizzle complet (tables créées à la main dans Supabase incluses) | `src/db/schema/index.ts`, migration `0002_supabase_manual_tables.sql` |
| Client Drizzle (pg, compatible Neon) | `src/lib/db.ts` |
| Tests unitaires + base Postgres en mémoire (PGlite) | `tests/`, `vitest.config.ts` |
| Outil de comparaison de deux bases (colonnes, nombre de lignes, checksum) | `scripts/migration/`, `npm run migration:compare` |
| CI GitHub Actions | `.github/workflows/ci.yml` |

Commandes : `npm test`, `npm run typecheck`.

> ⚠️ La migration `0002` ne doit **jamais** être appliquée sur Supabase : ces objets y existent déjà. Les migrations Drizzle ne servent qu'à créer une base neuve (Neon, tests).

## Projet Neon

| | |
|---|---|
| Projet | `round-hat-77068788` (« Home budget tracker »), org `org-muddy-queen-99619406` |
| Région | `aws-us-east-2`, Postgres 18 |
| Branches | `production` (défaut, **vide** : réservée à l'import des vraies données) · `dev` (tests, expire au bout de 7 jours, recréable avec `neon checkout dev --create`) |
| Services | Postgres + Neon Auth (Better Auth géré), déclarés dans `neon.ts` |
| Driver | `pg` + `attachDatabasePool` (`@vercel/functions`), comme le recommande Neon pour Vercel |
| Migrations | `npm run db:migrate` (utilise `DATABASE_URL_UNPOOLED`, la connexion directe) |
| Santé | `GET /api/health/db` avec `Authorization: Bearer $CRON_SECRET` |

Variables : `neon env pull` écrit `DATABASE_URL`, `DATABASE_URL_UNPOOLED` et `NEON_AUTH_*` dans `.env.local` pour la branche active (`neon checkout <branche>`).

## Étape 1 — Inventaire du schéma réel ✅

Résultat (20/11, lecture seule via l'API Supabase) : schéma **identique** à Neon après les migrations `0002` et `0003` (9 tables, 62 colonnes, mêmes types et nullabilité, aucune fonction RPC). Volumes : 4 utilisateurs (tous confirmés, tous avec leur ligne `users`), 1 foyer, 96 dépenses (dont 14 supprimées), 94 payeurs, 173 parts, 2 rapports mensuels.

Méthode initiale prévue : le schéma Drizzle a été reconstruit à partir du code et des scripts SQL. Il faut le confronter à la vraie base, qui a pu être modifiée depuis le tableau de bord Supabase.

- **Action (toi)** : récupérer la chaîne de connexion Postgres de Supabase (Project Settings → Database), puis lancer :
  `pg_dump "$SUPABASE_DB_URL" --schema=public --schema-only --no-owner --no-acl > supabase-schema.sql`
- **Moi** : comparer avec le schéma produit par les migrations, puis corriger le schéma Drizzle (migration `0003` si besoin).
- **Vérifications** :
  - comptages `auth.users` et `public.users` : chaque compte doit avoir sa ligne `users` ;
  - lignes orphelines : profils sans utilisateur, demandes d'adhésion vers des utilisateurs supprimés ;
  - triggers ou fonctions présents dans Supabase mais absents du schéma Drizzle.
- **Fini quand** : `migration:compare` entre Supabase et une base créée par les migrations ne signale aucune colonne manquante.

## Étape 2 — Accès aux données côté serveur

Remplacer chaque `supabase.from(...)` par une fonction serveur Drizzle (server actions ou fonctions dans `src/server/`), qui :

- lit l'utilisateur depuis la session, jamais depuis un paramètre envoyé par le client ;
- vérifie que l'utilisateur est membre du foyer concerné, puisque la RLS est désactivée aujourd'hui et que n'importe qui avec la clé anon peut tout lire.

Ordre proposé, une PR par domaine :

1. foyers et membres (liste, détail, création, suppression, renommage, code d'adhésion) ;
2. demandes d'adhésion ;
3. dépenses (liste, création, modification, suppression, duplication) et tableau de bord ;
4. profils (`user_profiles`) ;
5. rapport mensuel (la route cron passe de supabase-js à Drizzle).

- **Tests** : chaque fonction est testée sur PGlite, avec les règles d'accès (un non-membre est refusé) et les cas limites existants.
- **Prod** : `DATABASE_URL` est la chaîne de connexion **pooler** de Supabase. Aucun changement visible pour les utilisateurs.
- **Retour arrière** : revert de la PR.

## Étape 3 — Authentification (code et tests)

**Décision à prendre** :

| | Neon Auth (géré, déjà activé) | Better Auth auto-hébergé |
|---|---|---|
| Mots de passe | **Non transférables** : chaque utilisateur fait « mot de passe oublié » une fois | Conservés (vérification bcrypt) |
| Identifiants (UUID) | À conserver en insérant les comptes avec le même id (droit d'écriture sur `neon_auth` vérifié, à prouver sur `dev`) | Conservés |
| Emails d'auth | Expéditeur Neon partagé (codes), SMTP personnalisé pour les liens | Mailer Gmail existant |
| Code à maintenir | Faible (`@neon/auth`) | Moyen (routes d'auth dans l'app) |

Testé sur la branche `dev` : inscription, connexion, refus d'un mauvais mot de passe, session, déconnexion.

Si Better Auth auto-hébergé :

- [Better Auth](https://www.better-auth.com) avec l'adaptateur Drizzle, sur la même base. Les tables `session`, `account` et `verification` sont ajoutées par une migration.
- Les identifiants (UUID) des utilisateurs sont conservés : toutes les tables y font référence.
- **Mots de passe** : Supabase les stocke en bcrypt (`$2a$…`). La vérification accepte bcrypt, donc chaque utilisateur garde son mot de passe actuel.
- Script d'import `auth.users` → comptes Better Auth : email, hash, date de confirmation de l'email.
- La réinitialisation du mot de passe passe par le mailer SMTP déjà en place.
- Le middleware vérifie la session côté serveur.
- **Tests** : inscription, connexion, connexion avec un hash Supabase importé, mauvais mot de passe, réinitialisation, idempotence du script d'import.

## Étape 4 — Bascule de l'authentification (prod)

1. Mode maintenance quelques minutes.
2. Script d'import des comptes, puis vérification des comptages.
3. Déploiement du code Better Auth.
4. Test de connexion avec un vrai compte.

Les utilisateurs se reconnectent **une fois**, avec le même email et le même mot de passe.
**Retour arrière** : redéployer la version précédente. Supabase Auth n'a pas été modifié.

## Étape 5 — Bascule de la base vers Neon (prod)

1. Créer le projet Neon dans la région la plus proche de Supabase.
2. `DATABASE_URL=<neon> npx drizzle-kit migrate` sur la base Neon vide.
3. Répétition générale : copie complète, puis `migration:compare`.
4. Jour J :
   - maintenance (plus d'écritures) ;
   - `pg_dump "$SUPABASE_DB_URL" --data-only --schema=public --exclude-table='__drizzle*' | psql "$NEON_DB_URL"` ;
   - `SOURCE_DATABASE_URL=<supabase> TARGET_DATABASE_URL=<neon> npm run migration:compare`, qui doit afficher « All tables match » ;
   - changer `DATABASE_URL` dans Vercel (chaîne **pooled** de Neon), redéployer, faire un test rapide.

**Retour arrière** : remettre l'ancienne `DATABASE_URL`. Supabase n'a pas été modifié.

## Étape 6 — Nettoyage

- Supprimer `@supabase/supabase-js`, `src/lib/supabase/` et les variables `SUPABASE_*`.
- Garder le projet Supabase en lecture seule 2 à 4 semaines, puis le supprimer.
