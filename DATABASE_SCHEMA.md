# Schéma de Base de Données - Home Budget Tracker

## Vue d'ensemble

Ce schéma gère un système de suivi des dépenses partagées au sein de ménages (households). Il permet de suivre qui paie quoi et comment les dépenses sont réparties entre les membres.

```
users (1) ──── (n) household_members ──── (1) households
  ▲                                              ▲
  │                                              │
  └──── (1) expenses ◄── (n) expense_payers     │
               ▲  ▲                             │
               │  └──── (n) expense_splits      │
               │                                 │
               └──────── created_by_user_id ────┘
```

---

## Tables

### 📋 `users`
**Utilisateurs du système**

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | UUID | Identifiant principal, lié à `auth.users` |
| `email` | VARCHAR | Email unique |
| `display_name` | VARCHAR | Nom d'affichage |
| `created_at` | TIMESTAMP | Date de création (défaut: now) |
| `updated_at` | TIMESTAMP | Date de mise à jour (défaut: now) |

**PK**: `id`  
**FK**: `auth.users(id)`

---

### 🏠 `households`
**Les ménages (groupes d'utilisateurs)**

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | UUID | Identifiant principal (défaut: gen_random_uuid) |
| `name` | VARCHAR | Nom du ménage |
| `created_by_user_id` | UUID | Créateur du ménage |
| `created_at` | TIMESTAMP | Date de création (défaut: now) |
| `updated_at` | TIMESTAMP | Date de mise à jour (défaut: now) |

**PK**: `id`  
**FK**: `users(id)` via `created_by_user_id`

---

### 👥 `household_members`
**Membres d'un ménage**

| Colonne | Type | Valeurs / Notes |
|---------|------|-----------------|
| `id` | UUID | Identifiant principal |
| `household_id` | UUID | Référence au ménage |
| `user_id` | UUID | Référence à l'utilisateur |
| `role` | VARCHAR | Défaut: `'member'` |
| `status` | VARCHAR | Défaut: `'active'` |
| `joined_at` | TIMESTAMP | Date d'adhésion (défaut: now) |
| `left_at` | TIMESTAMP | Date de départ (optionnel) |
| `created_at` | TIMESTAMP | Date de création (défaut: now) |
| `updated_at` | TIMESTAMP | Date de mise à jour (défaut: now) |

**PK**: `id`  
**FK**: `households(id)`, `users(id)`

---

### 💰 `expenses`
**Les dépenses**

| Colonne | Type | Valeurs / Notes |
|---------|------|-----------------|
| `id` | UUID | Identifiant principal |
| `household_id` | UUID | Référence au ménage |
| `created_by_user_id` | UUID | Qui a créé la dépense |
| `description` | VARCHAR | Description de la dépense |
| `expense_date` | DATE | Date de la dépense |
| `currency` | VARCHAR | Code devise (défaut: `'EUR'`) |
| `expense_kind` | VARCHAR | Type: `'expense'` ou `'transfer'` |
| `notes` | TEXT | Notes optionnelles |
| `amount` | NUMERIC | Montant total (défaut: 0) |
| `created_at` | TIMESTAMP | Date de création (défaut: now) |
| `updated_at` | TIMESTAMP | Date de mise à jour (défaut: now) |
| `deleted_at` | TIMESTAMP | Soft-delete (optionnel) |

**PK**: `id`  
**FK**: `households(id)`, `users(id)` via `created_by_user_id`  
**Constraints**: 
- `expense_kind` doit être l'une des valeurs énumérées

---

### 💳 `expense_payers`
**Qui a payé chaque dépense**

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | UUID | Identifiant principal |
| `expense_id` | UUID | Référence à la dépense |
| `member_id` | UUID | Référence au membre qui a payé |
| `amount` | NUMERIC | Montant payé (> 0) |
| `created_at` | TIMESTAMP | Date de création (défaut: now) |

**PK**: `id`  
**FK**: `expenses(id)`, `household_members(id)`  
**Constraints**: 
- `amount > 0`

**Utilité**: 
- Une dépense peut avoir plusieurs payeurs
- Chaque payeur peut avoir payé une partie différente

---

### 📊 `expense_splits`
**Comment la dépense est répartie entre les membres**

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | UUID | Identifiant principal |
| `expense_id` | UUID | Référence à la dépense |
| `member_id` | UUID | Référence au membre qui reçoit cette part |
| `amount` | NUMERIC | Montant de la part (>= 0) |
| `created_at` | TIMESTAMP | Date de création (défaut: now) |

**PK**: `id`  
**FK**: `expenses(id)`, `household_members(id)`  
**Constraints**: 
- `amount >= 0`

**Utilité**: 
- Définit comment une dépense est divisée
- Chaque membre peut avoir une part différente (division égale ou inégale)

---

## Exemple d'utilisation

### Scénario: Alice et Bob partagent un appartement
```
1. Créer un ménage
   - households: (id=h1, name="Appartement A&B", created_by=alice)

2. Ajouter les membres
   - household_members: (id=hm1, household_id=h1, user_id=alice)
   - household_members: (id=hm2, household_id=h1, user_id=bob)

3. Alice paie 60€ d'épicerie pour elle et Bob
   - expenses: (id=exp1, household_id=h1, created_by=alice, 
                description="Épicerie", amount=60, currency="EUR")
   - expense_payers: (expense_id=exp1, member_id=hm1, amount=60)
   - expense_splits: (expense_id=exp1, member_id=hm1, amount=30)
   - expense_splits: (expense_id=exp1, member_id=hm2, amount=30)
   
   Résultat: Alice a payé 60€ mais elle en doit que 30€
             Bob doit 30€ à Alice
```

---

## Flux de calcul des soldes

Pour chaque membre:
1. **Total payé**: SUM(expense_payers.amount) pour ce membre
2. **Total à payer**: SUM(expense_splits.amount) pour ce membre
3. **Solde**: Montant à recevoir = Total payé - Total à payer

---

## Notes importantes

- **Soft delete**: La colonne `deleted_at` permet de marquer les dépenses comme supprimées sans les effacer physiquement
- **Contrôle de montant**: `amount > 0` pour les payeurs (on ne peut pas payer un montant négatif)
- **Contrôle de split**: `amount >= 0` pour les splits (on peut avoir une part de 0)
- **Historique**: Toutes les tables conservent `created_at` et `updated_at` pour traçabilité
- **Types de dépenses**: `expense_kind` permet de différencier les vraies dépenses vs les transferts directs
