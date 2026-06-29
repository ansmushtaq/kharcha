# MASTERCONTEXT — Monthly Budget Tracker App

> Living source-of-truth for the project. Update this after every major decision or implementation cycle.

---

## 1. Project Overview

A personal monthly budget tracking web app. Max 5 independent users — each user has their **own completely isolated budget**, categories, and data. Nothing is shared between users.

**App Name (working title):** `kharcha` (Urdu: expense)

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Auth | NextAuth.js v5 (Credentials provider) |
| ORM | Drizzle ORM |
| Database (dev) | Local PostgreSQL |
| Database (prod) | Neon (Vercel Postgres) |
| Deployment | Vercel |
| Charts | Recharts |

---

## 3. Core Data Model Concepts

### Category Types
Each user creates their own categories. Two types exist:

| Type | Meaning |
|---|---|
| `fixed` | A monthly recurring cost with a preset amount (e.g. Rent = 10,000). Adds to total budget. |
| `variable` | A label for logging daily transactions (e.g. Food, Transport). Does NOT add a preset amount to budget. |

### `carries_over` Flag (per category)
Controls whether the category automatically appears in future months.

| carries_over | Behaviour |
|---|---|
| `true` (default) | Category is visible in the month it was created AND all future months |
| `false` | Category is **only visible** in the month it was created (`created_for_month`) |

**Use cases:**
- Rent, WiFi, Food → `carries_over = true` (permanent categories)
- "Eid shopping" → `carries_over = false` (one-time, only for that month)

### Category Visibility Rule (per month M)
```
visible = (carries_over = true  AND created_for_month <= M)
       OR (carries_over = false AND created_for_month = M)
       AND is_active = true
```

### Budget Calculation (per user, per month M)
```
total_budget =
  SUM(fixed_amount for all visible FIXED categories in M)
  + (daily_limit × days_in_month(M))
```

Variable categories do not add to the budget — they are only used to label and categorize transactions logged against the daily budget.

### Example Setup (to seed manually via UI after first login)

**Fixed categories (carries_over = true):**
| Name | Amount |
|---|---|
| Rent | 10,000 |
| Fare | 5,000 |
| Donation | 3,730 |
| WiFi | 3,000 |
| Mobile | 2,000 |
| Bike | 2,000 |

**Daily limit:** 1,200/day

**Variable categories (carries_over = true):**
Food, Transport, Health, Shopping, Entertainment, Other

**Result:**
- 30-day month → 25,730 + 36,000 = **61,730 PKR**
- 31-day month → 25,730 + 37,200 = **62,930 PKR**

### Spare Money Snapshot (Wallet / Bank / Loans Given)
A separate, lightweight feature for checking how much money is actually "spare" right now, on top of the monthly budget tracking above.

User manually keeps two numbers up to date (no transaction log, just an editable snapshot, like `daily_limit`):
- **Wallet balance** — cash on hand
- **Bank balance** — combined bank total

Plus an itemized list of **loans given** — money lent to other people, each with a borrower name, amount, date, and a repaid/outstanding status.

**Key insight:** wallet + bank already reflect whatever has been spent so far this month (that money physically left those accounts). So spare money is compared against what's *left* to spend, not the full monthly budget:

```
remaining_budget_this_month = total_budget(month) − total_spent_so_far(month)
spare_money = wallet_balance + bank_balance − remaining_budget_this_month
owed_to_you = SUM(amount) for all loans_given WHERE is_repaid = false
```

`owed_to_you` is always shown as a **separate** figure, never added into `spare_money` — it isn't liquid yet. `spare_money` is computed live on every fetch; nothing about the calculation itself is stored.

**Enable / disable:** this whole feature is opt-in per user, via `finances_enabled` on `user_finances` (default `false`). Turning it off only hides the Settings section and the Dashboard card — wallet/bank balances and loan records are never deleted, so re-enabling shows everything exactly as it was left.

---

## 4. Database Schema (Drizzle / Neon Postgres)

```ts
// schema.ts

// ─── Users ───────────────────────────────────────────────────────────────────
// Seeded manually via seed.ts. No public registration.
users {
  id:            uuid PK (gen_random_uuid())
  name:          varchar(100)
  email:         varchar(255) UNIQUE
  password_hash: varchar(255)          // bcrypt
  created_at:    timestamp
}

// ─── User Categories ─────────────────────────────────────────────────────────
// Replaces both `fixed_costs` and hardcoded expense category strings.
// Fully per-user — no sharing across users.
user_categories {
  id:                uuid PK
  user_id:           uuid FK → users.id  ON DELETE CASCADE
  name:              varchar(100)
  type:              varchar(10)         // 'fixed' | 'variable'
  fixed_amount:      integer (nullable)  // only for type='fixed', PKR whole number
  carries_over:      boolean DEFAULT true
  created_for_month: char(7) NOT NULL   // 'YYYY-MM' — month this category was first added
  color:             varchar(7) (nullable) // optional hex color e.g. '#e74c3c'
  sort_order:        integer DEFAULT 0
  is_active:         boolean DEFAULT true
  created_at:        timestamp
}

// ─── Per-User Budget Config ───────────────────────────────────────────────────
// One row per user.
user_budget_config {
  id:          uuid PK
  user_id:     uuid FK → users.id UNIQUE  ON DELETE CASCADE
  daily_limit: integer DEFAULT 1200       // PKR/day, whole number
  updated_at:  timestamp
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
// Daily transaction log. Per-user. References user_categories.
expenses {
  id:          uuid PK
  user_id:     uuid FK → users.id       ON DELETE CASCADE
  category_id: uuid FK → user_categories.id ON DELETE SET NULL (nullable)
  date:        date                     // YYYY-MM-DD
  amount:      integer                  // PKR, whole number
  note:        text (nullable)
  created_at:  timestamp
}

// ─── User Finances (Wallet / Bank Snapshot) ───────────────────────────────────
// One row per user. Manually-updated snapshot, not a transaction log.
user_finances {
  id:               uuid PK
  user_id:          uuid FK → users.id UNIQUE  ON DELETE CASCADE
  finances_enabled: boolean DEFAULT false  // opt-in; off hides UI only, data preserved
  wallet_balance:   integer DEFAULT 0     // PKR, cash on hand
  bank_balance:     integer DEFAULT 0     // PKR, combined bank total
  updated_at:       timestamp
}

// ─── Loans Given ────────────────────────────────────────────────────────────────
// Money the user has lent to others. Itemized, per-user.
loans_given {
  id:             uuid PK
  user_id:        uuid FK → users.id     ON DELETE CASCADE
  borrower_name:  varchar(100)
  amount:         integer                // PKR, whole number
  date_lent:      date                   // YYYY-MM-DD
  is_repaid:      boolean DEFAULT false
  repaid_at:      timestamp (nullable)   // set server-side when marked repaid
  note:           text (nullable)
  created_at:     timestamp
}
```

### Indexes
```sql
CREATE INDEX ON expenses (user_id, date);
CREATE INDEX ON user_categories (user_id, created_for_month);
CREATE INDEX ON loans_given (user_id, is_repaid);
```

---

## 5. App Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx                  # Login form (credentials)
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Protected layout, bottom nav (mobile)
│   │   ├── page.tsx                      # Dashboard — current month overview
│   │   ├── expenses/
│   │   │   └── page.tsx                  # Log + view recent expenses
│   │   ├── history/
│   │   │   └── page.tsx                  # Month-by-month history + charts
│   │   └── settings/
│   │       └── page.tsx                  # Categories + daily limit (per user)
│   └── api/
│       ├── auth/[...nextauth]/
│       │   └── route.ts
│       ├── categories/
│       │   ├── route.ts                  # GET (list for month), POST (create)
│       │   └── [id]/route.ts             # PATCH (edit), DELETE
│       ├── expenses/
│       │   ├── route.ts                  # GET (by month), POST (create)
│       │   └── [id]/route.ts             # DELETE
│       ├── summary/
│       │   └── route.ts                  # GET monthly summary for current user
│       ├── budget-config/
│       │   └── route.ts                  # GET, PATCH (daily limit)
│       ├── finances/
│       │   └── route.ts                  # GET (balances + live spare money), PATCH (balances)
│       └── loans/
│           ├── route.ts                  # GET (list), POST (create)
│           └── [id]/route.ts             # PATCH (edit / mark repaid), DELETE
├── components/
│   ├── ui/                               # shadcn/ui primitives
│   ├── dashboard/
│   │   ├── BudgetOverview.tsx            # Total budget vs spent ring/progress bar
│   │   ├── DailyProgress.tsx             # Today's spending vs daily_limit
│   │   ├── FixedCategoriesList.tsx       # Fixed categories + amounts this month
│   │   ├── QuickAddForm.tsx              # Fast inline expense entry on dashboard
│   │   ├── AlertBanner.tsx               # Over/warning budget banner
│   │   └── SpareMoneyCard.tsx            # Wallet+bank vs remaining budget, + owed-to-you
│   ├── expenses/
│   │   ├── ExpenseForm.tsx               # Full add-expense form
│   │   ├── ExpenseList.tsx               # Grouped list of expense entries
│   │   └── CategoryBadge.tsx             # Colored pill with category name
│   ├── history/
│   │   ├── MonthPicker.tsx               # Prev/next month navigation
│   │   ├── MonthlySummaryCard.tsx        # Budget vs spent summary for a month
│   │   └── CategoryBreakdownChart.tsx    # Recharts bar/donut — variable expenses by category
│   ├── settings/
│   │   ├── CategoryForm.tsx              # Add/edit category modal
│   │   ├── CategoryTable.tsx             # List of user's categories with controls
│   │   ├── DailyLimitInput.tsx           # Edit daily limit inline
│   │   ├── FinancesToggle.tsx            # Enable/disable the whole Finances feature
│   │   ├── FinancesForm.tsx              # Wallet balance + bank balance inputs
│   │   ├── LoanForm.tsx                  # Add/edit loan modal (borrower, amount, date, note)
│   │   └── LoansTable.tsx                # List of loans given, mark-repaid toggle, delete
│   └── layout/
│       ├── BottomNav.tsx                 # Mobile bottom nav (Dashboard / Expenses / History / Settings)
│       └── TopBar.tsx                    # App title + current user name
├── lib/
│   ├── db.ts                             # Neon + Drizzle client
│   ├── auth.ts                           # NextAuth config
│   ├── schema.ts                         # Drizzle schema (as above)
│   ├── budget.ts                         # Budget calculation helpers
│   └── seed.ts                           # One-time user seed script
└── middleware.ts                         # Protect all dashboard routes
```

---

## 6. Feature Specs

### 6.1 Auth
- **Credentials provider** (email + password, bcrypt)
- **No public /register route** — users created via `npx tsx src/lib/seed.ts`
- JWT session (stateless, Vercel-friendly)
- Middleware protects all routes except `/login`
- Each user's session scopes ALL queries — users can never see each other's data

### 6.2 Dashboard (current month, current user only)
- **BudgetOverview** — circular progress: total spent / total budget, colour-coded
- **AlertBanner** — warning (≥85%) or over-budget (>100%) state
- **DailyProgress** — today's spend vs daily_limit, progress bar + remaining amount
- **FixedCategoriesList** — list of user's active fixed categories visible this month + their amounts
- **QuickAddForm** — amount + category dropdown (variable categories only) + optional note, date defaults to today
- **SpareMoneyCard** — wallet + bank balance minus remaining budget for the month; owed-to-you shown as a separate line (see 6.7)

### 6.3 Expense Logging (`/expenses`)
- Full form: amount, category (variable only), note, date (date picker)
- List: grouped by date, most recent first
- Delete own entries (hard delete, no edit)
- Shows running total per day

### 6.4 Monthly History (`/history`)
- MonthPicker: ← YYYY-MM →
- **MonthlySummaryCard** per selected month:
  - Total budget (fixed + daily)
  - Total spent
  - Over/under delta
  - Daily average variable spend
- **CategoryBreakdownChart** — Recharts donut/bar — variable expense totals by category
- Fixed categories listed below chart with their amounts

### 6.5 Settings (`/settings`) — per user, isolated
#### Categories section
- Table of all user's categories (name, type, amount if fixed, carries_over toggle, active toggle)
- **Add category** button → modal with:
  - Name (text)
  - Type: Fixed | Variable
  - Amount (number — only shown if type = Fixed)
  - Carries over next month: Yes | No toggle
  - Color picker (optional)
- Edit: opens same modal pre-filled
- Delete: confirmation dialog; if category has expenses linked → warn user, SET NULL on category_id
- `carries_over` toggle inline in table (no modal needed)

#### Daily Limit section
- Simple number input with save button
- Shows how it affects monthly total for 30 and 31 day months

### 6.6 Budget Alerts
| State | Trigger | UI |
|---|---|---|
| On track | spent < 85% of budget | Green progress + no banner |
| Warning | 85% ≤ spent < 100% | Yellow banner: "You've used X% of your budget" |
| Over budget | spent ≥ 100% of budget | Red banner: "Over budget by PKR X,XXX" |

Shown on Dashboard and History cards.

### 6.7 Finances & Spare Money
#### Settings (`/settings`) — new "Finances" section
- **Top of section: enable/disable toggle** — "Track wallet, bank & loans" Yes/No switch, bound to `finances_enabled`. When off, the rest of this section (FinancesForm + LoansTable) is hidden; toggling back on reveals existing data unchanged.
- **FinancesForm** — wallet balance + bank balance number inputs, single save button (upserts `user_finances`)
- **LoansTable** — list of loans given (borrower name, amount, date lent, repaid/outstanding badge)
  - **Add loan** button → modal with: borrower name (text), amount (number), date lent (date picker, defaults to today), note (optional)
  - Mark repaid: inline toggle/button — sets `is_repaid = true`, `repaid_at = now()` server-side
  - Delete: confirmation dialog, hard delete
  - Edit: opens same modal pre-filled

#### Dashboard — `SpareMoneyCard`
- Only rendered if `finances_enabled = true` for the current user; otherwise the dashboard simply has one less card (no empty placeholder)
- Headline figure: **spare money** = `wallet_balance + bank_balance − remaining_budget_this_month`
- Secondary line: **owed to you** = sum of outstanding loans (shown separately, never added into the headline figure)
- Expandable breakdown: wallet balance, bank balance, remaining budget this month
- Spare money is recalculated on every fetch — it is never stored

---

## 7. API Routes

> All routes are session-scoped. Every query filters by `session.user.id`. No cross-user data leakage possible.

### Categories

**`GET /api/categories?month=YYYY-MM`**
Returns categories visible for the given month using the visibility rule.
If `month` omitted, defaults to current month.

**`POST /api/categories`**
```json
{
  "name": "Rent",
  "type": "fixed",
  "fixed_amount": 10000,
  "carries_over": true,
  "color": "#e74c3c"
}
```
Sets `created_for_month` to the current month server-side.

**`PATCH /api/categories/[id]`**
Update any field: name, fixed_amount, carries_over, is_active, color, sort_order.

**`DELETE /api/categories/[id]`**
Hard deletes category. Sets `category_id = NULL` on linked expenses.

---

### Expenses

**`GET /api/expenses?month=YYYY-MM`**
Returns all expenses for the month, joined with category name + color.

**`POST /api/expenses`**
```json
{ "date": "2026-06-29", "amount": 450, "category_id": "uuid", "note": "lunch" }
```

**`DELETE /api/expenses/[id]`**
Hard delete. Only succeeds if expense belongs to current user.

---

### Summary

**`GET /api/summary?month=YYYY-MM`**
```json
{
  "month": "2026-06",
  "days_in_month": 30,
  "daily_limit": 1200,
  "total_daily_budget": 36000,
  "total_fixed_budget": 25730,
  "total_budget": 61730,
  "total_variable_spent": 18400,
  "total_spent": 44130,
  "over_under": -17600,
  "fixed_categories": [
    { "id": "uuid", "name": "Rent", "amount": 10000, "carries_over": true }
  ],
  "variable_breakdown": [
    { "category_id": "uuid", "name": "Food", "color": "#27ae60", "total": 12000 },
    { "category_id": "uuid", "name": "Transport", "color": "#3498db", "total": 4200 }
  ]
}
```

---

### Budget Config

**`GET /api/budget-config`**
Returns `{ daily_limit: 1200 }` for current user.

**`PATCH /api/budget-config`**
```json
{ "daily_limit": 1500 }
```
Creates row if not exists (upsert).

---

### Finances

**`GET /api/finances`**
Returns the user's enabled-state, wallet/bank balances, and live-computed spare money figures for the current month.
```json
{
  "finances_enabled": true,
  "wallet_balance": 8000,
  "bank_balance": 15000,
  "updated_at": "2026-06-29T10:00:00Z",
  "remaining_budget_this_month": 14600,
  "spare_money": 8400,
  "owed_to_you": 5000,
  "outstanding_loans_count": 2
}
```
`remaining_budget_this_month`, `spare_money`, `owed_to_you`, and `outstanding_loans_count` are computed on every request — none of them are persisted. If `finances_enabled` is `false`, the client just hides the relevant UI; the endpoint still returns the same shape.

**`PATCH /api/finances`**
```json
{ "finances_enabled": true, "wallet_balance": 8000, "bank_balance": 15000 }
```
Upserts `user_finances`. Any field may be omitted to leave it unchanged — e.g. send only `{ "finances_enabled": false }` to disable.

---

### Loans Given

**`GET /api/loans?status=outstanding|repaid|all`**
Defaults to `all`, most recent (`date_lent`) first.

**`POST /api/loans`**
```json
{ "borrower_name": "Ali", "amount": 3000, "date_lent": "2026-06-10", "note": "for rent" }
```

**`PATCH /api/loans/[id]`**
Edit any field, or mark repaid:
```json
{ "is_repaid": true }
```
Server sets `repaid_at = now()` whenever `is_repaid` flips to `true`.

**`DELETE /api/loans/[id]`**
Hard delete. Only succeeds if the loan belongs to current user.

---

## 8. Seed Script (`src/lib/seed.ts`)

Seeds user accounts only. No categories or budget config — users set those up themselves via `/settings` after first login.

```ts
// Run: npx tsx src/lib/seed.ts
const users = [
  { name: "Ans", email: "ans@example.com", password: "changeme123" },
  // up to 4 more
];
// Script bcrypt-hashes each password, inserts into users table
// Also upserts a default budget_config row for each user (daily_limit: 1200)
```

---

## 9. Database Setup

Two environments — local PostgreSQL for dev, Neon for production. Same schema, same migrations, same seed script. Only the connection string differs.

---

### 9a. Local Development (PostgreSQL)

**Install packages:**
```bash
npm install drizzle-orm postgres bcryptjs
npm install -D drizzle-kit tsx @types/bcryptjs
```

**Create local database:**
```bash
createdb kharcha
# or via psql:
psql -U postgres -c "CREATE DATABASE kharcha;"
```

**`.env.local`:**
```env
DATABASE_URL=postgresql://postgres@localhost:5432/kharcha
DATABASE_URL_UNPOOLED=postgresql://postgres@localhost:5432/kharcha
NEXTAUTH_SECRET=any-random-string-for-local
NEXTAUTH_URL=http://localhost:3000
```

> For local postgres, `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are the same value.

---

### 9b. Production (Neon on Vercel)

**Install packages** (swap `postgres` for `@neondatabase/serverless`):
```bash
npm install drizzle-orm @neondatabase/serverless bcryptjs
npm install -D drizzle-kit tsx @types/bcryptjs
```

**Create Neon DB:**
```bash
# Vercel CLI can handle this:
vercel link                  # link local project to Vercel project
vercel integration add neon  # provision Neon DB + auto-inject env vars
vercel env pull .env.local   # pull all env vars locally
```

> If CLI doesn't support `vercel integration add neon`, do it manually:
> vercel.com → project → Storage → Connect Store → Neon → Create → Connect → then `vercel env pull .env.local`

**`.env.local` (auto-populated by Vercel after pull):**
```env
DATABASE_URL=             # Neon pooled connection string (auto-injected)
DATABASE_URL_UNPOOLED=    # Neon direct connection string (auto-injected)
NEXTAUTH_SECRET=          # generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

---

### 9c. `db.ts` — works for BOTH local and Neon

```ts
// src/lib/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? 'require' : false,
})

export const db = drizzle(client, { schema })
```

> Uses `postgres-js` driver for both environments. SSL is auto-enabled only when the URL contains `neon.tech`.

**Required package:** `npm install postgres` (not `@neondatabase/serverless`)

---

### 9d. `drizzle.config.ts`

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema:  './src/lib/schema.ts',
  out:     './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
})
```

---

### 9e. Migration + Seed Commands (same for both environments)

```bash
npx drizzle-kit generate    # generate SQL migration from schema.ts
npx drizzle-kit migrate     # apply migration to DB (local or Neon)
npx tsx src/lib/seed.ts     # seed user accounts
```

Run `generate` + `migrate` any time `schema.ts` changes.

---

## 10. Key Rules & Constraints

1. **PKR only, whole integers** — no floats anywhere in DB or UI
2. **All data is per-user** — zero sharing between users (categories, budget config, expenses, summaries)
3. **No public registration** — user management only via seed script
4. **category_id is nullable on expenses** — if a category is deleted, existing expenses retain their amount but lose the label (shown as "Uncategorized")
5. **No edit on expenses** — delete and re-add only
6. **Month boundaries are strict** — YYYY-MM, 1st to last day; no custom date ranges
7. **Mobile-first UI** — bottom nav, cards stacked vertically, large tap targets
8. **carries_over only affects visibility, not data** — existing expenses are never deleted when carries_over changes
9. **Settings changes are instant** — no versioning or history of config changes (for now)
10. **Fixed categories contribute to budget; variable categories do not** — variable categories only organize transaction data
11. **Spare money is always computed live** — `wallet_balance + bank_balance − remaining_budget_this_month` is calculated on every fetch, never stored
12. **Loans given are independent of expenses** — marking a loan repaid never creates an expense or income record; no transaction-log integration
13. **Finances feature is opt-in, off by default** — `finances_enabled` gates UI visibility only; disabling never deletes wallet/bank balances or loan records

---

## 11. Implementation Order (Recommended)

```
Phase 1 — Foundation
  [ ] Init Next.js 14 (app router, TypeScript, Tailwind)
  [ ] Install + configure shadcn/ui
  [ ] Install drizzle-orm, postgres, bcryptjs, drizzle-kit, tsx
  [ ] Place schema.ts + db.ts + drizzle.config.ts
  [ ] LOCAL: createdb kharcha → set .env.local → drizzle-kit generate + migrate
  [ ] PROD: vercel link → vercel integration add neon (or dashboard) → vercel env pull
  [ ] Run seed.ts (users only)

Phase 2 — Auth
  [ ] NextAuth v5 credentials provider + bcrypt
  [ ] /login page UI
  [ ] middleware.ts (protect dashboard routes)
  [ ] Test session scoping

Phase 3 — Categories (Settings)
  [ ] /api/categories CRUD
  [ ] /settings page: CategoryTable + CategoryForm modal
  [ ] carries_over toggle inline
  [ ] DailyLimitInput + /api/budget-config PATCH

Phase 4 — Expense Logging ✅ (2026-06-30)
  [x] /api/expenses CRUD
  [x] /expenses page: ExpenseForm + ExpenseList
  [x] CategoryBadge component

Phase 5 — Dashboard
  [ ] /api/summary
  [ ] BudgetOverview ring chart
  [ ] DailyProgress bar
  [ ] FixedCategoriesList
  [ ] QuickAddForm
  [ ] AlertBanner (warning + over-budget)

Phase 6 — Finances (Wallet / Bank / Loans + Spare Money)
  [ ] /api/finances (GET balances + live spare money, PATCH balances + toggle)
  [ ] /api/loans CRUD + mark-repaid
  [ ] /settings: FinancesToggle (enable/disable, default off)
  [ ] /settings: FinancesForm (wallet/bank inputs)
  [ ] /settings: LoansTable + LoanForm modal
  [ ] Dashboard: SpareMoneyCard (conditionally rendered)

Phase 7 — History + Charts
  [ ] /history page + MonthPicker
  [ ] MonthlySummaryCard
  [ ] CategoryBreakdownChart (Recharts)

Phase 8 — Polish + Deploy
  [ ] Mobile responsiveness pass (bottom nav, tap targets)
  [ ] Loading skeletons + error states
  [ ] Empty states (no categories yet, no expenses yet)
  [ ] Deploy to Vercel + connect Neon env vars
```

---

---
## 12. Production Review & Fixes (2026-06-30)

Post Phase 1-3 review by production-code-engineer agent. All critical/high items fixed. Medium/low items deferred unless noted.

### CRITICAL — Fixed

| # | File | Issue | Fix |
|---|---|------|-----|
| C1 | `src/lib/db.ts` | Middleware crashed — `postgres()` opened TCP at module eval, incompatible with Edge Runtime | Lazy Proxy: `getDb()` defers connection until first query, Proxy re-exports `db` transparently |
| C2 | `src/app/api/categories/[id]/route.ts` | PATCH/DELETE always 404 — `params` not awaited (Next.js 14.2+ makes params `Promise`) | Changed type to `Promise<{ id: string }>`, `const { id } = await params` |

### HIGH — Fixed

| # | File | Issue | Fix |
|---|---|------|-----|
| H1 | `src/app/api/categories/[id]/route.ts` | Invalid `type` values accepted in PATCH; type/fixed_amount interaction bug (reading stale `body.type` not DB value) | Validate `type` ∈ `["fixed","variable"]`; if changing to variable, auto-null `fixedAmount` unless explicitly provided |
| H2 | `src/app/api/categories/route.ts` | String `"abc"` passed type coercion check for `fixed_amount` | Added `typeof fixed_amount !== "number" \|\| !Number.isFinite(fixed_amount)` |
| H3 | `src/app/api/categories/route.ts` | No month format validation on GET `?month=` | `isValidMonth()` regex: `/^\d{4}-(0[1-9]\|1[0-2])$/` |
| H4 | `src/app/api/categories/[id]/route.ts` | TOCTOU: SELECT ownership check, then UPDATE without userId filter | Single atomic `UPDATE ... WHERE id = X AND user_id = Y` — delete check via `.returning()` null check |
| L3 | `src/app/api/categories/[id]/route.ts` | `sort_order: "abc"` accepted (type coercion) | `typeof === "number" && Number.isInteger()` check |
| — | `src/app/api/categories/route.ts` | Color not validated in POST/PATCH | Hex regex: `/^#[0-9a-fA-F]{6}$/` |

### MEDIUM / LOW — Deferred

| # | Issue | Why deferred |
|---|---|------|
| H5 | No rate limiting on credentials endpoint | 5 users max, seeded-only accounts; add if brute-force becomes possible |
| M1 | Stale closure on double-click toggle (CategoryTable) | UX polish; add optimistic update when it matters |
| M2-M4 | Silent fetch failures in UI (CategoryTable, DailyLimitInput) | Add global error toast in Phase 8 (Polish) |
| M5 | `Response.redirect` vs `NextResponse.redirect` in middleware | Works correctly; revisit if redirect behavior changes |
| M6 | No color validation on POST (fixed alongside H-fixes above) | Done |
| M7 | `currentMonth()` uses server timezone | Acceptable for single-user local dev; add client-side month override in Phase 4 |
| L1 | No clear error when `DATABASE_URL` unset | Add startup check in Phase 8 |
| L2 | Missing dark mode color variants (green-600, badges) | Add in Phase 8 (Polish) |
| L5 | Inconsistent shadcn `Input` usage (raw `<input>` in login page) | Fine for now; migrate if shadcn Input is added |
| L6 | Race: `router.push("/")` before session cookie ready | Very brief window; add `useSession` check if it causes flashes |
| L7 | `NEXTAUTH_SECRET` vs `AUTH_SECRET` naming | `NEXTAUTH_SECRET` fallback works; rename to `AUTH_SECRET` before production |

### Engineering Notes

- **`src/lib/db.ts` uses a Proxy** — any Drizzle method call on `db` lazily creates the `postgres` client on first access. This means modules importing `db` (including `auth.ts` → `middleware.ts`) no longer trigger TCP connections at module evaluation time. The Proxy is transparent to callers; no existing code changed.
- **Ownership checks are now single-query** — PATCH uses `WHERE userId = session.user.id` in the UPDATE itself; DELETE uses the same WHERE + `.returning()` to confirm a row was affected. No SELECT-then-mutate races.
- **Validation is per-route, not centralized** — each route validates its own inputs. If the API surface grows beyond 10 routes, extract a shared validation layer (zod or valibot).

### Phase 4 — Expense Logging (2026-06-30)

| File | Notes |
|---|---|
| `src/app/api/expenses/route.ts` | GET joins `user_categories` for `categoryName`/`categoryColor`; POST validates `date` (YYYY-MM-DD), `amount` (positive integer), `category_id` (optional, must reference a variable category owned by user), `note` (string). Month validation via `isValidMonth()`. |
| `src/app/api/expenses/[id]/route.ts` | DELETE with `await params`, single-query ownership check (`WHERE id = X AND user_id = Y`), `.returning()` null check for 404. |
| `src/components/expenses/CategoryBadge.tsx` | Colored pill at 12.5% opacity tint; "Uncategorized" fallback when `name` is null (category deleted, ON DELETE SET NULL). |
| `src/components/expenses/ExpenseForm.tsx` | Fetches only variable categories for dropdown (fixed categories never appear). Client-side validation. Native date picker defaults to today. |
| `src/components/expenses/ExpenseList.tsx` | Groups by date descending, running daily totals, delete with confirm dialog + optimistic removal. Handles loading/empty/error states. |
| `src/app/(dashboard)/expenses/page.tsx` | Client component, wires form + list via `refreshKey` counter. |

**Phase 4 patterns (from Phase 1-3 review):**
- Lazy `db` via Proxy (no change needed)
- `params: Promise<{ id }>` + `await params` in DELETE
- Single-query ownership checks (`userId` in WHERE + `.returning()` null check)
- `typeof` checks for all numeric inputs (PKR whole integers only)
- `isValidMonth()` regex validation on GET `?month=`

---

*Last updated: June 2026 (Phase 4 — Expense Logging complete) | Stack: Next.js 14 + Neon + Drizzle + NextAuth v5*
