# Migration Supabase → Neon

Objectif : quitter Supabase (base **et** authentification) sans perte de données, de façon transparente pour les utilisateurs : mêmes comptes, mêmes mots de passe, et ceux qui sont connectés le restent.

```
Étape 0  Fondations : tests, schéma, outils                       ✅
Étape 1  Inventaire du schéma réel de Supabase                     ✅
Étape 2  Authentification Better Auth                              ✅
Étape 3  Accès aux données côté serveur (Drizzle + session)        ✅
Étape 4  Répétition générale avec les vraies données               ✅
Étape 5  Bascule de la production                                  ← voir le déroulé
Étape 6  Nettoyage (2 à 4 semaines après)
```

## Architecture après migration

| | Avant | Après |
|---|---|---|
| Base | Supabase Postgres | Neon Postgres 18 (`round-hat-77068788`, branche `production`, `aws-us-east-2`) |
| Accès aux données | navigateur → API Supabase avec la clé publique, sans RLS (tout était lisible et modifiable) | server actions (`src/server/actions`) → Drizzle ; session vérifiée et appartenance au foyer contrôlée à chaque appel |
| Auth | Supabase Auth | Better Auth dans l'app (`/api/auth/*`), tables `users` / `sessions` / `accounts` / `verifications` |
| Mots de passe | bcrypt chez Supabase | les hash bcrypt sont importés tels quels ; les nouveaux sont en scrypt |
| Sessions existantes | `localStorage` de supabase-js | échangées une fois contre une session Better Auth (`src/lib/supabaseBridge.ts`) |
| Driver | — | `pg` + `attachDatabasePool` (Vercel Fluid), comme le recommande Neon |

Code :
- `src/server/data/*` : fonctions pures `(db, userId, …)`, testées sur PGlite. Elles renvoient les mêmes formes de données que l'API Supabase, ce qui limite les changements dans les pages.
- `src/server/actions/*` : server actions minces, avec la session et des erreurs lisibles via `ActionResult`.
- `src/lib/auth.ts`, `src/lib/supabaseBridge.ts`, `src/hooks/useAuth.ts`, `src/middleware.ts` : authentification.
- `scripts/migration/*` : copie, vérification, import des comptes, migrations en HTTPS.

## Tests

- `npm test` : 71 tests (PGlite).
  - Soldes, rapport mensuel et emails.
  - Schéma : contraintes et suppressions en cascade.
  - Auth : inscription, connexion, comptes importés en bcrypt, réinitialisation du mot de passe, pont de session Supabase.
  - Couche de données : formes renvoyées, calculs, **règles d'accès** (un non-membre est refusé, seul le propriétaire gère le foyer).
  - Outils de copie et de comparaison.
- Répétitions avec les **vraies données** (lecture seule sur Supabase) :
  - copie vers un Postgres local et vers Neon `dev` : 377 lignes vérifiées une par une, aucune différence ;
  - l'app sur la copie, avec un navigateur :
    - pages Foyers (solde −45,11 €, identique au calcul SQL), Détail du foyer, Dépenses (82) et Tableau de bord ;
    - modification, duplication, suppression et création d'une dépense ;
    - santé de la base ;
    - rapport mensuel (`dryRun`, aperçu « Tu dois 45,09 € à Marie Balossier », anti-doublon).
- Erreur React #418 (hydratation) sur `/expenses/new` : **déjà présente sur `main`**, sans rapport avec la migration.

## Étape 5 — Déroulé de la bascule

### Préparation (toi, une seule fois)

1. **Supabase → SQL Editor**, exécuter :
   ```sql
   create or replace function public.export_auth_users() returns json
   language sql security definer set search_path = '' as $$
     select coalesce(json_agg(json_build_object(
       'id', id, 'email', email,
       'encrypted_password', encrypted_password,
       'email_confirmed_at', email_confirmed_at
     )), '[]'::json) from auth.users
   $$;
   revoke execute on function public.export_auth_users() from public, anon, authenticated;
   ```
   Seule la clé secrète (`service_role`) peut l'appeler. Les hash ne passent jamais par le chat.
2. **Vercel → Settings → Environment Variables → Production** :
   - `DATABASE_URL` : Neon → Connect → branche `production` → **Pooled connection** ;
   - `BETTER_AUTH_SECRET` : `openssl rand -base64 32` ;
   - `BETTER_AUTH_URL` : `https://hbt-beryl.vercel.app` ;
   - à garder : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pont de session), `CRON_SECRET`, `SMTP_*`.

   Ces variables n'ont aucun effet sur la version actuelle : elle ne les lit pas.

### Jour J (quelques minutes)

1. `TARGET_DATABASE_URL=<neon production direct> npm run db:migrate:http`
2. `… NEON_HTTP=1 npm run migration:from-supabase`. Ça copie les données, vérifie chaque ligne et importe les comptes. Attendu : « ✓ Data copied and verified » et « Accounts: 4 imported ».
3. Merge de la PR dans `main`. Vercel déploie (1 à 2 minutes).
4. Contrôles :
   - `GET /api/health/db` ;
   - connexion avec un vrai compte ;
   - rapport mensuel en `dryRun`.
5. `… npm run migration:from-supabase -- --verify-only`. Ça repère une éventuelle écriture faite sur l'ancienne version pendant le déploiement : à reporter à la main s'il y en a.
6. Supabase SQL Editor : `drop function public.export_auth_users();`

**Retour arrière** : revert du merge. Supabase n'a jamais été modifié : l'ancienne version repart telle quelle.

## Étape 6 — Nettoyage (2 à 4 semaines après)

- Retirer le pont de session (`src/lib/supabaseBridge.ts`, `src/components/auth/SupabaseSessionBridge.tsx`) et les variables `NEXT_PUBLIC_SUPABASE_*`.
- Retirer Neon Auth de `neon.ts` (inutilisé) et lancer `neon deploy`.
- Supprimer le projet Supabase.
