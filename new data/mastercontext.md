# MASTERCONTEXT — Monthly Budget Tracker App (kharcha)

> Living source-of-truth. Update after every major decision or implementation cycle.

---

## 1. Project Overview

A personal monthly budget tracking web app. Max 5 independent users — each user has their **own completely isolated budget**, categories, and data. Nothing is shared between users.

**App Name:** `kharcha` (Urdu: expense)

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

### 3.1 Salary

Each user records their monthly salary. This is informational — it doesn't drive budget calculations directly, but is shown on the dashboard as context alongside the budget.

```
salary = 150,000 PKR (example)
total_budget = fixed_costs + daily_pool = 61,730 PKR
implied_savings = salary - total_budget = 88,270 PKR
```

Salary is stored on `user_budget_config`. It does NOT feed into the spare money calculation (wallet/bank already reflect physical cash).

---

### 3.2 Category Types

Each user creates their own categories. Two types:

| Type | Meaning |
|---|---|
| `fixed` | A monthly recurring cost with a preset amount (e.g. Rent = 10,000). Adds to total budget. Can be paid fully or partially. Unpaid balance rolls over. |
| `variable` | A label for logging daily transactions (e.g. Food, Transport). Does NOT add a preset amount to the budget. |

---

### 3.3 `carries_over` Flag (per category)

| carries_over | Behaviour |
|---|---|
| `true` (default) | Category visible from `created_for_month` onwards forever |
| `false` | Category visible **only** in `created_for_month` (one-time) |

Changing this flag never touches existing expense data.

**Category visibility rule for month M:**
```
visible = (carries_over = true  AND created_for_month <= M)
       OR (carries_over = false AND created_for_month = M)
       AND is_active = true
```

---

### 3.4 Rolling Fixed Cost Balance (Sinking Fund)

Fixed categories accumulate an outstanding balance if not fully paid each month.

```
Example: Bike = 2,000/month allocation
  Month 1: paid 0    → outstanding 2,000
  Month 2: paid 0    → outstanding 4,000
  Month 3: paid 0    → outstanding 6,000
  Month 4: paid 500  → outstanding 7,500
  Month 5 (now):     → +2,000 allocation → total outstanding 9,500
```

**Calculation (per fixed category C, up to and including month M):**
```
outstanding_balance(C, M) =
  SUM over each month X where C is visible in X and X <= M:
    allocation(C, X) - paid_in_month(C, X)

where:
  allocation(C, X) = C.fixed_amount
  paid_in_month(C, X) = SUM of expenses WHERE category_id = C.id
                        AND date falls within month X
```

This is computed dynamically from the `expenses` table — no separate balance table needed.

**Partial payments are allowed:** logging a 500 PKR expense against Bike means you paid 500 of the 2,000 owed that month. The remaining 1,500 rolls to next month.

---

### 3.5 Daily Budget Countdown

The daily pool is time-based. Each day that passes consumes 1,200 from the pool, regardless of whether you spent anything.

```
total_daily_pool   = daily_limit × days_in_month    (e.g. 1,200 × 30 = 36,000)
variable_spent     = SUM of all variable expenses this month so far
remaining_pool     = total_daily_pool - variable_spent
days_remaining     = days_in_month - today's_day_number + 1  (includes today)
effective_daily_rate = remaining_pool / days_remaining
```

**Option B — overspend eats into future days:**
```
Day 1:  pool = 36,000 | spend 2,000 | remaining = 34,000
Day 2:  remaining = 34,000 | days_remaining = 29 | rate = 1,172/day
Day 30: if underspent overall → remaining > 1,200 | rate > 1,200
        if overspent overall  → remaining < 1,200 | rate < 1,200
```

On Day 30 of a clean month: remaining = 1,200. That is the design.

The UI shows:
- **Remaining pool** — PKR left in the daily budget
- **Effective rate** — PKR/day going forward
- **Progress bar** — remaining / total (shrinks by date + spending)

---

### 3.6 Budget Calculation (per user, per month M)

```
total_budget = SUM(fixed_amount for visible FIXED categories in M)
             + (daily_limit × days_in_month(M))

Example (30 days):
  fixed  = 10,000 + 5,000 + 3,730 + 3,000 + 2,000 + 2,000 = 25,730
  daily  = 1,200 × 30 = 36,000
  total  = 61,730 PKR
```

---

### 3.7 Spare Money Snapshot (Wallet / Bank / Loans)

A separate opt-in feature. User manually records wallet and bank balances. Spare money is computed live:

```
remaining_budget_this_month = total_budget - total_spent_so_far
spare_money = wallet_balance + bank_balance - remaining_budget_this_month
owed_to_you = SUM of outstanding loans given
```

`owed_to_you` is always shown separately — never added into `spare_money`. Spare money is never stored — recomputed on every fetch.

---

## 4. Database Schema (Drizzle / Neon Postgres)

```ts
// ─── Users ────────────────────────────────────────────────────────────────────
users {
  id:            uuid PK (gen_random_uuid())
  name:          varchar(100)
  email:         varchar(255) UNIQUE
  password_hash: varchar(255)
  created_at:    timestamp
}

// ─── User Categories ──────────────────────────────────────────────────────────
// Per-user. type='fixed' adds to budget and supports rolling balance.
// type='variable' is for daily transaction logging only.
user_categories {
  id:               uuid PK
  user_id:          uuid FK → users.id ON DELETE CASCADE
  name:             varchar(100)
  type:             varchar(10)          // 'fixed' | 'variable'
  fixed_amount:     integer (nullable)   // only for type='fixed', PKR whole number
  carries_over:     boolean DEFAULT true
  created_for_month: char(7) NOT NULL   // 'YYYY-MM'
  color:            varchar(7) (nullable) // hex e.g. '#e74c3c'
  sort_order:       integer DEFAULT 0
  is_active:        boolean DEFAULT true
  created_at:       timestamp
}

// ─── Per-User Budget Config ───────────────────────────────────────────────────
// One row per user. Includes salary (informational) and daily_limit.
user_budget_config {
  id:          uuid PK
  user_id:     uuid FK → users.id UNIQUE ON DELETE CASCADE
  salary:      integer DEFAULT 0        // ★ NEW — monthly income in PKR
  daily_limit: integer DEFAULT 1200     // PKR/day
  updated_at:  timestamp
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
// Covers BOTH variable daily expenses AND fixed cost payments.
// category_id can reference a fixed OR variable category.
// For fixed categories: this is a "payment" against the monthly allocation.
// For variable categories: this is a regular daily expense.
expenses {
  id:          uuid PK
  user_id:     uuid FK → users.id ON DELETE CASCADE
  category_id: uuid FK → user_categories.id ON DELETE SET NULL (nullable)
  date:        date                     // 'YYYY-MM-DD'
  amount:      integer                  // PKR, whole number
  note:        text (nullable)
  created_at:  timestamp
}

// ─── User Finances (Wallet / Bank Snapshot) ───────────────────────────────────
// One row per user. Opt-in. Manually updated snapshot.
user_finances {
  id:               uuid PK
  user_id:          uuid FK → users.id UNIQUE ON DELETE CASCADE
  finances_enabled: boolean DEFAULT false
  wallet_balance:   integer DEFAULT 0
  bank_balance:     integer DEFAULT 0
  updated_at:       timestamp
}

// ─── Loans Given ──────────────────────────────────────────────────────────────
loans_given {
  id:            uuid PK
  user_id:       uuid FK → users.id ON DELETE CASCADE
  borrower_name: varchar(100)
  amount:        integer
  date_lent:     date
  is_repaid:     boolean DEFAULT false
  repaid_at:     timestamp (nullable)
  note:          text (nullable)
  created_at:    timestamp
}
```

### Indexes
```sql
CREATE INDEX ON expenses (user_id, date);
CREATE INDEX ON expenses (user_id, category_id);   -- ★ NEW — for rolling balance queries
CREATE INDEX ON user_categories (user_id, created_for_month);
CREATE INDEX ON loans_given (user_id, is_repaid);
```

### ★ Schema Migration Required
Two changes from Phase 1 schema:
1. Add `salary integer DEFAULT 0` to `user_budget_config`
2. Add index on `expenses(user_id, category_id)`
3. Remove API-level restriction that prevented fixed categories from being used in expenses

```bash
# After updating schema.ts:
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## 5. App Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    # Protected, bottom nav
│   │   ├── page.tsx                      # Dashboard
│   │   ├── expenses/page.tsx             # Log expenses + pay bills
│   │   ├── history/page.tsx              # Monthly history + charts
│   │   └── settings/page.tsx            # Categories, salary, daily limit, finances
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── categories/
│       │   ├── route.ts                  # GET (list for month), POST
│       │   └── [id]/route.ts             # PATCH, DELETE
│       ├── expenses/
│       │   ├── route.ts                  # GET (by month), POST (fixed OR variable)
│       │   └── [id]/route.ts             # DELETE
│       ├── summary/
│       │   └── route.ts                  # GET — full monthly summary incl. rolling balances
│       ├── budget-config/
│       │   └── route.ts                  # GET, PATCH (salary + daily_limit)
│       ├── finances/
│       │   └── route.ts                  # GET (balances + spare money), PATCH
│       └── loans/
│           ├── route.ts                  # GET, POST
│           └── [id]/route.ts             # PATCH (mark repaid), DELETE
├── components/
│   ├── ui/                               # shadcn/ui
│   ├── dashboard/
│   │   ├── SalaryCard.tsx                # ★ NEW — salary, budget, implied savings
│   │   ├── BudgetOverview.tsx            # Total budget vs total spent ring
│   │   ├── DailyProgress.tsx             # ★ UPDATED — countdown pool, effective rate
│   │   ├── FixedCategoriesList.tsx       # ★ UPDATED — shows outstanding balance per category
│   │   ├── QuickAddForm.tsx              # Fast variable expense entry
│   │   ├── AlertBanner.tsx               # Over/warning budget banner
│   │   └── SpareMoneyCard.tsx            # Wallet + bank − remaining budget
│   ├── expenses/
│   │   ├── ExpenseForm.tsx               # ★ UPDATED — variable expenses only
│   │   ├── BillPaymentForm.tsx           # ★ NEW — pay against a fixed category
│   │   ├── ExpenseList.tsx               # Grouped list with daily totals
│   │   └── CategoryBadge.tsx             # Colored pill, "Uncategorized" fallback
│   ├── history/
│   │   ├── MonthPicker.tsx
│   │   ├── MonthlySummaryCard.tsx
│   │   └── CategoryBreakdownChart.tsx    # Recharts donut/bar
│   ├── settings/
│   │   ├── CategoryForm.tsx
│   │   ├── CategoryTable.tsx
│   │   ├── SalaryDailyLimitInput.tsx     # ★ UPDATED — salary + daily limit together
│   │   ├── FinancesToggle.tsx
│   │   ├── FinancesForm.tsx
│   │   ├── LoanForm.tsx
│   │   └── LoansTable.tsx
│   └── layout/
│       ├── BottomNav.tsx
│       └── TopBar.tsx
├── lib/
│   ├── db.ts
│   ├── auth.ts
│   ├── schema.ts
│   ├── budget.ts                         # ★ UPDATED — countdown + rolling balance helpers
│   └── seed.ts
└── middleware.ts
```

---

## 6. Feature Specs

### 6.1 Auth
- Credentials (email + password, bcrypt), JWT session
- No public `/register` — seed only
- Middleware protects all routes except `/login`
- All queries scoped to `session.user.id`

---

### 6.2 Dashboard

**SalaryCard** ★ NEW
- Salary (editable inline, links to settings)
- Total monthly budget
- Implied savings (salary − budget)

**BudgetOverview**
- Ring chart: total spent / total budget
- Includes both variable expenses AND fixed category payments in "spent"

**AlertBanner**
- Warning ≥ 85% | Over budget > 100%

**DailyProgress** ★ UPDATED
- Remaining daily pool (PKR) — not a static 1,200
- Effective daily rate going forward
- Progress bar: remaining / total_daily_pool
- Shows "X days remaining in month"
- Formula:
  ```
  remaining_pool = (daily_limit × days_in_month) - variable_spent_this_month
  effective_rate = remaining_pool / days_remaining_including_today
  ```

**FixedCategoriesList** ★ UPDATED
- Each fixed category shows:
  - Monthly allocation (e.g. Rent: 10,000)
  - Paid this month (e.g. 0)
  - **Outstanding balance** (cumulative unpaid, e.g. 9,000 for Bike)
  - "Pay" button → opens BillPaymentForm pre-filled with that category
- Color coding: green = fully paid, yellow = partially paid, red = unpaid

**QuickAddForm**
- Variable expenses only (amount + variable category + optional note)
- Date defaults to today

**SpareMoneyCard** (shown only if `finances_enabled = true`)
- Spare money = wallet + bank − remaining budget
- Owed to you (outstanding loans) — separate line

---

### 6.3 Expense Logging (`/expenses`) ★ UPDATED

Page has two tabs: **Log Expense** and **Pay a Bill**

**Log Expense tab (variable categories):**
- Amount, variable category, note (optional), date (defaults to today)
- Variable categories only in dropdown

**Pay a Bill tab (fixed categories):** ★ NEW
- Amount field is labeled **"Amount you're paying now"** — NOT "new remaining balance".
  The user always enters the payment they are making in this transaction (e.g. 500),
  never the target outstanding total. This matches how variable expense logging
  already works (enter today's spend, not today's remaining budget) and matches
  the underlying data model: every payment is a new row in `expenses`, summed to
  derive `outstanding_balance`. There is no reverse-math mode.
- Amount (can be partial — e.g. pay 5,000 of 10,000 Rent)
- Fixed category dropdown (shows current outstanding balance next to each option,
  so the user can see what they owe before deciding how much to pay)
- Note (optional), date (defaults to today)
- Saves as a regular expense with `category_id` = fixed category
- After save: outstanding_balance recalculates automatically (derived, not stored)

**Expense List:**
- Grouped by date, most recent first
- Fixed category payments shown with a "bill" icon to distinguish from variable
- Running daily total (variable only)
- Delete with confirmation (hard delete)

---

### 6.4 Monthly History (`/history`)
- MonthPicker: ← YYYY-MM →
- MonthlySummaryCard:
  - Total budget (fixed allocations + daily pool)
  - Total spent (variable + fixed payments)
  - Over/under delta
  - Daily average variable spend
  - Outstanding fixed balances at end of that month
- CategoryBreakdownChart — variable expenses by category (Recharts donut/bar)
- Fixed categories table — allocation vs paid vs outstanding for that month

---

### 6.5 Settings (`/settings`)

**Budget section** ★ UPDATED
- Salary input (number, PKR)
- Daily limit input (number, PKR)
- Single save button
- Preview: "30-day month total = X | 31-day month total = Y"

**Categories section**
- CategoryTable: name, type, amount (if fixed), carries_over toggle, active toggle
- Add/Edit modal: name, type, amount, carries_over, color
- Delete: warn if expenses exist → SET NULL on category_id

**Finances section** (opt-in)
- Enable/disable toggle (`finances_enabled`)
- Wallet balance + bank balance inputs
- LoansTable + LoanForm modal

---

### 6.6 Budget Alerts

| State | Trigger | UI |
|---|---|---|
| On track | spent < 85% | Green |
| Warning | 85% ≤ spent < 100% | Yellow banner |
| Over budget | spent ≥ 100% | Red banner |

Shown on Dashboard and History.

---

### 6.7 Finances & Spare Money
- Opt-in per user (`finances_enabled = false` by default)
- Disabling hides UI only — data never deleted
- `spare_money` computed on every fetch, never stored
- `owed_to_you` never added into spare money

---

## 7. API Routes

> All routes session-scoped. Every query filters by `session.user.id`.

### Categories
- `GET /api/categories?month=YYYY-MM` — visible categories for month
- `POST /api/categories` — create (sets `created_for_month` server-side)
- `PATCH /api/categories/[id]` — update any field
- `DELETE /api/categories/[id]` — hard delete, SET NULL on expenses

### Expenses ★ UPDATED
- `GET /api/expenses?month=YYYY-MM` — all expenses (fixed + variable) joined with category
- `POST /api/expenses` — accepts fixed OR variable `category_id`
  ```json
  { "date": "2026-06-29", "amount": 5000, "category_id": "uuid", "note": "partial rent" }
  ```
  Validation: `category_id` must belong to current user (any type allowed)
- `DELETE /api/expenses/[id]` — hard delete, ownership check

### Summary ★ UPDATED
`GET /api/summary?month=YYYY-MM`
```json
{
  "month": "2026-06",
  "salary": 150000,
  "days_in_month": 30,
  "daily_limit": 1200,
  "total_daily_pool": 36000,
  "variable_spent": 18400,
  "remaining_daily_pool": 17600,
  "days_remaining": 2,
  "effective_daily_rate": 8800,
  "total_fixed_budget": 25730,
  "total_budget": 61730,
  "total_spent": 44130,
  "over_under": -17600,
  "fixed_categories": [
    {
      "id": "uuid",
      "name": "Rent",
      "fixed_amount": 10000,
      "paid_this_month": 10000,
      "outstanding_balance": 0,
      "carries_over": true
    },
    {
      "id": "uuid",
      "name": "Bike",
      "fixed_amount": 2000,
      "paid_this_month": 0,
      "outstanding_balance": 9000,
      "carries_over": true
    }
  ],
  "variable_breakdown": [
    { "category_id": "uuid", "name": "Food", "color": "#27ae60", "total": 12000 },
    { "category_id": "uuid", "name": "Transport", "color": "#3498db", "total": 4200 }
  ]
}
```

`outstanding_balance` per fixed category = cumulative unpaid across ALL months, not just current.

### Budget Config ★ UPDATED
- `GET /api/budget-config` → `{ salary: 150000, daily_limit: 1200 }`
- `PATCH /api/budget-config` → `{ "salary": 150000, "daily_limit": 1200 }` (upsert)

### Finances
- `GET /api/finances` → balances + live spare money + owed_to_you
- `PATCH /api/finances` → update wallet/bank/enabled (upsert)

### Loans
- `GET /api/loans?status=outstanding|repaid|all`
- `POST /api/loans` → `{ borrower_name, amount, date_lent, note }`
- `PATCH /api/loans/[id]` → edit or `{ "is_repaid": true }` (server sets `repaid_at`)
- `DELETE /api/loans/[id]` → hard delete

---

## 8. `budget.ts` Helpers ★ UPDATED

```ts
// Days in a given month
export function daysInMonth(month: string): number
// e.g. daysInMonth("2026-06") → 30

// Days remaining in month from a given date (inclusive)
export function daysRemaining(month: string, today: Date): number

// Total daily pool
export function totalDailyPool(dailyLimit: number, month: string): number

// Effective daily rate going forward
export function effectiveDailyRate(
  remainingPool: number,
  daysRemaining: number
): number

// Rolling outstanding balance for a fixed category up to a given month
export function outstandingBalance(
  fixedAmount: number,
  createdForMonth: string,
  paymentsPerMonth: Record<string, number>, // { 'YYYY-MM': amountPaid }
  upToMonth: string
): number
```

---

## 9. Seed Script

Seeds user accounts + default `user_budget_config` (salary: 0, daily_limit: 1200).
No categories — users set those up via Settings after first login.

```bash
npx tsx src/lib/seed.ts
```

---

## 10. Database Setup

### Local (dev)
```env
DATABASE_URL=postgresql://postgres@localhost:5432/kharcha
DATABASE_URL_UNPOOLED=postgresql://postgres@localhost:5432/kharcha
NEXTAUTH_SECRET=any-random-string
NEXTAUTH_URL=http://localhost:3000
```

### Production (Neon)
```bash
vercel link
vercel integration add neon   # or via Vercel dashboard
vercel env pull .env.local
```

### `db.ts` (works for both)
```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? 'require' : false,
})
export const db = drizzle(client, { schema })
```

### Migration commands
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
npx tsx src/lib/seed.ts
```

---

## 11. Key Rules & Constraints

1. **PKR only, whole integers** — no floats anywhere
2. **All data is per-user** — zero sharing
3. **No public registration** — seed only
4. **`category_id` nullable on expenses** — deleted category → "Uncategorized"
5. **No edit on expenses** — delete and re-add
6. **Month boundaries strict** — YYYY-MM, 1st to last day
7. **Mobile-first** — bottom nav, stacked cards, large tap targets
8. **`carries_over` affects visibility only** — never deletes data
9. **Settings changes instant** — no versioning
10. **Variable categories don't add to budget** — only fixed categories do
11. **Fixed categories CAN have expenses** — this is how partial/full payment is tracked
12. **Rolling balance computed dynamically** — never stored, always derived from expenses
13. **Daily countdown is pool-based** — `remaining = total_pool - variable_spent`, not static 1,200/day
14. **Overspend carries forward (Option B)** — eats into future daily budget automatically
15. **Salary is informational** — shown on dashboard, doesn't affect spare money calc
16. **Spare money computed live** — never stored
17. **Finances feature opt-in** — `finances_enabled = false` default, disabling hides UI only

---

## 12. Implementation Order

```
Phase 1 — Foundation ✅
  [x] Next.js 14, Tailwind, shadcn/ui
  [x] Drizzle ORM + postgres driver
  [x] schema.ts, db.ts, drizzle.config.ts
  [x] Local DB + migrations
  [x] seed.ts

Phase 2 — Auth ✅
  [x] NextAuth v5 credentials + bcrypt
  [x] /login page
  [x] middleware.ts

Phase 3 — Categories ✅ (minor fix needed)
  [x] /api/categories CRUD
  [x] /settings: CategoryTable + CategoryForm
  [x] carries_over toggle
  [x] DailyLimitInput
  [ ] ★ Add salary field to /api/budget-config + Settings UI
  [ ] ★ Run migration: add salary column to user_budget_config
  [ ] ★ Remove API restriction on fixed categories in /api/expenses POST

Phase 4 — Expense Logging ✅
  [x] /api/expenses CRUD
  [x] /expenses page: ExpenseForm + ExpenseList
  [x] CategoryBadge

Phase 5 — Dashboard (NEXT — build with correct logic)
  [ ] /api/summary with:
        - salary, remaining_daily_pool, days_remaining, effective_daily_rate
        - outstanding_balance per fixed category (rolling, all months)
  [ ] budget.ts helpers (daysInMonth, daysRemaining, outstandingBalance etc.)
  [ ] SalaryCard
  [ ] BudgetOverview ring chart
  [ ] DailyProgress (countdown pool + effective rate, NOT static 1,200)
  [ ] FixedCategoriesList (with outstanding_balance + Pay button)
  [ ] BillPaymentForm (pay against fixed category, partial OK)
  [ ] QuickAddForm (variable only)
  [ ] AlertBanner
  [ ] Update /expenses page: add "Pay a Bill" tab for fixed categories

Phase 6 — Finances (Wallet / Bank / Loans)
  [ ] /api/finances GET + PATCH
  [ ] /api/loans CRUD
  [ ] Settings: FinancesToggle + FinancesForm + LoansTable + LoanForm
  [ ] Dashboard: SpareMoneyCard (conditional)

Phase 7 — History + Charts
  [ ] /history page + MonthPicker
  [ ] MonthlySummaryCard (incl. fixed outstanding balances)
  [ ] CategoryBreakdownChart (Recharts)
  [ ] Fixed vs variable breakdown per month

Phase 8 — Polish + Deploy
  [ ] Mobile responsiveness pass
  [ ] Loading skeletons + error states
  [ ] Empty states
  [ ] Deploy to Vercel + Neon env vars
```

---

## 13. Production Review & Bug Fixes (2026-06-30)

Applied after Phase 1-3 review. All critical/high items fixed.

### CRITICAL — Fixed

| # | File | Issue | Fix |
|---|---|---|---|
| C1 | `src/lib/db.ts` | Middleware crashed — `postgres()` TCP at module eval, Edge Runtime incompatible | Lazy Proxy: `getDb()` defers connection until first query |
| C2 | `src/app/api/categories/[id]/route.ts` | PATCH/DELETE always 404 — `params` not awaited (Next.js 14.2+) | `const { id } = await params` |

### HIGH — Fixed

| # | File | Issue | Fix |
|---|---|---|---|
| H1 | `categories/[id]/route.ts` | Invalid `type` values accepted; type/fixed_amount interaction bug | Validate type ∈ ["fixed","variable"]; auto-null fixedAmount when switching to variable |
| H2 | `categories/route.ts` | String "abc" passed type coercion for `fixed_amount` | `typeof !== "number" \|\| !Number.isFinite()` check |
| H3 | `categories/route.ts` | No month format validation on GET `?month=` | `isValidMonth()` regex `/^\d{4}-(0[1-9]|1[0-2])$/` |
| H4 | `categories/[id]/route.ts` | TOCTOU: SELECT ownership check then UPDATE without userId filter | Single atomic `UPDATE WHERE id=X AND user_id=Y` |
| L3 | `categories/[id]/route.ts` | `sort_order: "abc"` accepted | `typeof === "number" && Number.isInteger()` |
| — | `categories/route.ts` | Color not validated | Hex regex `/^#[0-9a-fA-F]{6}$/` |

### Deferred

| # | Issue | When |
|---|---|---|
| H5 | No rate limiting on credentials | Phase 8 (5 users, low risk now) |
| M1 | Stale closure on double-click toggle | Phase 8 (optimistic update) |
| M2-M4 | Silent fetch failures in UI | Phase 8 (global error toast) |
| M7 | `currentMonth()` uses server timezone | Phase 8 (client-side month override) |
| L7 | `NEXTAUTH_SECRET` vs `AUTH_SECRET` naming | Before production deploy |

### Engineering Notes
- **`src/lib/db.ts` uses a Proxy** — lazy connection, transparent to callers
- **Ownership checks are single-query** — `WHERE userId = session.user.id` in UPDATE/DELETE
- **Validation is per-route** — extract to shared layer (zod/valibot) if routes exceed 10

---

## 14. Phase 4 Implementation Details (2026-06-30)

| File | Notes |
|---|---|
| `src/app/api/expenses/route.ts` | GET joins `user_categories`; POST validates date (YYYY-MM-DD), amount (positive int), optional category_id (variable only at time of writing — ★ to be relaxed in Phase 5) |
| `src/app/api/expenses/[id]/route.ts` | DELETE with `await params`, single-query ownership, `.returning()` null check for 404 |
| `src/components/expenses/CategoryBadge.tsx` | 12.5% opacity tint; "Uncategorized" fallback |
| `src/components/expenses/ExpenseForm.tsx` | Variable categories only in dropdown; client-side validation; native date picker |
| `src/components/expenses/ExpenseList.tsx` | Groups by date desc, running daily totals, delete with confirm, optimistic removal |
| `src/app/(dashboard)/expenses/page.tsx` | Client component, `refreshKey` counter wires form + list |

---

*Last updated: June 2026 — Phase 4 complete, Phase 5 ready to build*
*Stack: Next.js 14 + Neon + Drizzle + NextAuth v5*
