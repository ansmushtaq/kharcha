import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  char,
  text,
  index,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Users ────────────────────────────────────────────────────────────────────
// Seeded manually via seed.ts. No public registration.

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         varchar('name', { length: 100 }).notNull(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

// ─── User Categories ──────────────────────────────────────────────────────────
// Fully per-user. Replaces both fixed_costs table and hardcoded category strings.
//
// type:
//   'fixed'    → has a monthly preset amount, contributes to total budget
//   'variable' → label for daily transactions only, no preset amount
//
// carries_over:
//   true  → visible from created_for_month onwards (permanent)
//   false → visible ONLY in created_for_month (one-time)

export const userCategories = pgTable(
  'user_categories',
  {
    id:               uuid('id').primaryKey().defaultRandom(),
    userId:           uuid('user_id')
                        .notNull()
                        .references(() => users.id, { onDelete: 'cascade' }),
    name:             varchar('name', { length: 100 }).notNull(),
    type:             varchar('type', { length: 10 }).notNull(), // 'fixed' | 'variable'
    fixedAmount:      integer('fixed_amount'),                   // null for variable type
    carriesOver:      boolean('carries_over').notNull().default(true),
    createdForMonth:  char('created_for_month', { length: 7 }).notNull(), // 'YYYY-MM'
    color:            varchar('color', { length: 7 }),           // hex e.g. '#e74c3c'
    sortOrder:        integer('sort_order').notNull().default(0),
    isActive:         boolean('is_active').notNull().default(true),
    createdAt:        timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userMonthIdx: index('uc_user_month_idx').on(table.userId, table.createdForMonth),
  })
)

// ─── Per-User Budget Config ───────────────────────────────────────────────────
// One row per user. Created on first login or via seed.
// salary is informational only — shown on dashboard, does NOT affect
// spare money or budget calculations (those use wallet/bank balances).

export const userBudgetConfig = pgTable('user_budget_config', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id')
                .notNull()
                .references(() => users.id, { onDelete: 'cascade' })
                .unique(),
  salary:     integer('salary').notNull().default(0),          // PKR, monthly income — informational
  dailyLimit: integer('daily_limit').notNull().default(1200),  // PKR/day
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
})

// ─── Expenses ─────────────────────────────────────────────────────────────────
// Daily transaction log. Per-user. category_id nullable — SET NULL on category delete.
// category_id can reference EITHER a 'fixed' or 'variable' category:
//   - variable category → a regular daily expense
//   - fixed category     → a payment (full or partial) against that month's
//                          allocation; used to compute outstanding_balance

export const expenses = pgTable(
  'expenses',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    userId:     uuid('user_id')
                  .notNull()
                  .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
                  .references(() => userCategories.id, { onDelete: 'set null' }),
    date:       date('date').notNull(),            // 'YYYY-MM-DD'
    amount:     integer('amount').notNull(),        // PKR, whole numbers only
    note:       text('note'),                       // optional
    createdAt:  timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userDateIdx: index('exp_user_date_idx').on(table.userId, table.date),
    userCategoryIdx: index('exp_user_category_idx').on(table.userId, table.categoryId),
  })
)

// ─── User Finances (Wallet / Bank Snapshot) ──────────────────────────────────
// One row per user. A manually-updated snapshot — NOT a transaction log.
// spare_money is always computed live (wallet + bank − remaining budget for
// the current month); nothing about the calculation is stored here.

export const userFinances = pgTable('user_finances', {
  id:              uuid('id').primaryKey().defaultRandom(),
  userId:          uuid('user_id')
                     .notNull()
                     .references(() => users.id, { onDelete: 'cascade' })
                     .unique(),
  financesEnabled: boolean('finances_enabled').notNull().default(false), // user opt-in; off hides UI only, data is preserved
  walletBalance:   integer('wallet_balance').notNull().default(0), // PKR, cash on hand
  bankBalance:     integer('bank_balance').notNull().default(0),   // PKR, combined bank total
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
})

// ─── Loans Given ──────────────────────────────────────────────────────────────
// Money the user has lent out to others. Itemized so each can be tracked and
// marked repaid individually. Separate from `expenses` — repaying a loan does
// NOT create an expense or income record.

export const loansGiven = pgTable(
  'loans_given',
  {
    id:           uuid('id').primaryKey().defaultRandom(),
    userId:       uuid('user_id')
                    .notNull()
                    .references(() => users.id, { onDelete: 'cascade' }),
    borrowerName: varchar('borrower_name', { length: 100 }).notNull(),
    amount:       integer('amount').notNull(),       // PKR, whole number
    dateLent:     date('date_lent').notNull(),        // 'YYYY-MM-DD'
    isRepaid:     boolean('is_repaid').notNull().default(false),
    repaidAt:     timestamp('repaid_at'),             // set server-side when marked repaid
    note:         text('note'),                       // optional
    createdAt:    timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userRepaidIdx: index('loans_user_repaid_idx').on(table.userId, table.isRepaid),
  })
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  categories:   many(userCategories),
  expenses:     many(expenses),
  budgetConfig: one(userBudgetConfig),
  finances:     one(userFinances),
  loansGiven:   many(loansGiven),
}))

export const userCategoriesRelations = relations(userCategories, ({ one, many }) => ({
  user:     one(users, {
    fields:     [userCategories.userId],
    references: [users.id],
  }),
  expenses: many(expenses),
}))

export const userBudgetConfigRelations = relations(userBudgetConfig, ({ one }) => ({
  user: one(users, {
    fields:     [userBudgetConfig.userId],
    references: [users.id],
  }),
}))

export const expensesRelations = relations(expenses, ({ one }) => ({
  user: one(users, {
    fields:     [expenses.userId],
    references: [users.id],
  }),
  category: one(userCategories, {
    fields:     [expenses.categoryId],
    references: [userCategories.id],
  }),
}))

export const userFinancesRelations = relations(userFinances, ({ one }) => ({
  user: one(users, {
    fields:     [userFinances.userId],
    references: [users.id],
  }),
}))

export const loansGivenRelations = relations(loansGiven, ({ one }) => ({
  user: one(users, {
    fields:     [loansGiven.userId],
    references: [users.id],
  }),
}))

// ─── Types ────────────────────────────────────────────────────────────────────
// Inferred types for use across the app

export type User           = typeof users.$inferSelect
export type NewUser        = typeof users.$inferInsert

export type UserCategory    = typeof userCategories.$inferSelect
export type NewUserCategory = typeof userCategories.$inferInsert

export type UserBudgetConfig    = typeof userBudgetConfig.$inferSelect
export type NewUserBudgetConfig = typeof userBudgetConfig.$inferInsert

export type Expense    = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert

export type UserFinances    = typeof userFinances.$inferSelect
export type NewUserFinances = typeof userFinances.$inferInsert

export type LoanGiven    = typeof loansGiven.$inferSelect
export type NewLoanGiven = typeof loansGiven.$inferInsert
