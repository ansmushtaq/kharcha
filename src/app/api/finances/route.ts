import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { userFinances, loansGiven, expenses, userCategories, userBudgetConfig } from "@/lib/schema"
import { eq, and, or, lte, gte, sql } from "drizzle-orm"
import { currentMonth, daysInMonth } from "@/lib/validation"

// GET /api/finances
// Returns the user's enabled-state, wallet/bank balances, and live-computed spare
// money figures for the current month.
//
// If user_finances row doesn't exist yet, returns defaults (enabled=false, balances=0).
// remaining_budget_this_month, spare_money, owed_to_you, and outstanding_loans_count
// are computed on every request — none of them are persisted.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  // 1. Fetch user_finances row (may not exist yet)
  const [finances] = await db
    .select({
      financesEnabled: userFinances.financesEnabled,
      walletBalance:   userFinances.walletBalance,
      bankBalance:     userFinances.bankBalance,
      updatedAt:       userFinances.updatedAt,
    })
    .from(userFinances)
    .where(eq(userFinances.userId, userId))
    .limit(1)

  const financesEnabled = finances?.financesEnabled ?? false
  const walletBalance   = finances?.walletBalance   ?? 0
  const bankBalance     = finances?.bankBalance     ?? 0
  const updatedAt       = finances?.updatedAt       ?? null

  // 2. Compute remaining budget for the current month
  const month = currentMonth()
  const dInMonth = daysInMonth(month)
  const startDate = `${month}-01`
  const endDate = `${month}-${String(dInMonth).padStart(2, "0")}`

  // 2a. Fetch daily_limit
  const [budgetConfig] = await db
    .select({ dailyLimit: userBudgetConfig.dailyLimit })
    .from(userBudgetConfig)
    .where(eq(userBudgetConfig.userId, userId))
    .limit(1)
  const dailyLimit = budgetConfig?.dailyLimit ?? 1200

  // 2b. Fetch visible fixed categories for the month
  const fixedCategories = await db
    .select({ amount: userCategories.fixedAmount })
    .from(userCategories)
    .where(
      and(
        eq(userCategories.userId, userId),
        eq(userCategories.isActive, true),
        eq(userCategories.type, "fixed"),
        or(
          and(
            eq(userCategories.carriesOver, true),
            lte(userCategories.createdForMonth, month),
          ),
          and(
            eq(userCategories.carriesOver, false),
            eq(userCategories.createdForMonth, month),
          ),
        ),
      ),
    )

  const totalFixedBudget = fixedCategories.reduce(
    (sum, c) => sum + (c.amount ?? 0),
    0,
  )
  const totalDailyBudget = dailyLimit * dInMonth
  const totalBudget = totalFixedBudget + totalDailyBudget

  // 2c. Total spent for the month
  const [totalSpentResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, userId),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate),
      ),
    )
  const totalSpent = Number(totalSpentResult?.total ?? 0)
  const remainingBudgetThisMonth = Math.max(0, totalBudget - totalSpent)

  // 3. Compute spare money (live, never stored)
  // spare_money = wallet + bank - remaining_budget_this_month
  const spareMoney = walletBalance + bankBalance - remainingBudgetThisMonth

  // 4. Compute owed_to_you = SUM(amount) for outstanding loans
  const [owedResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${loansGiven.amount}), 0)` })
    .from(loansGiven)
    .where(
      and(
        eq(loansGiven.userId, userId),
        eq(loansGiven.isRepaid, false),
      ),
    )
  const owedToYou = Number(owedResult?.total ?? 0)

  // 5. Count outstanding loans
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(loansGiven)
    .where(
      and(
        eq(loansGiven.userId, userId),
        eq(loansGiven.isRepaid, false),
      ),
    )
  const outstandingLoansCount = Number(countResult?.count ?? 0)

  return NextResponse.json({
    finances_enabled:            financesEnabled,
    wallet_balance:              walletBalance,
    bank_balance:                bankBalance,
    updated_at:                  updatedAt?.toISOString() ?? null,
    remaining_budget_this_month: remainingBudgetThisMonth,
    spare_money:                 spareMoney,
    owed_to_you:                 owedToYou,
    outstanding_loans_count:     outstandingLoansCount,
  })
}

// PATCH /api/finances
// Upserts user_finances. Any field may be omitted to leave it unchanged.
// Accepts: finances_enabled (boolean), wallet_balance (non-negative integer),
//          bank_balance (non-negative integer).
// Uses onConflictDoUpdate on the unique userId column.
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Build updates object — each field is independently validated
  const updates: Record<string, unknown> = {}

  if (body.finances_enabled !== undefined) {
    if (typeof body.finances_enabled !== "boolean") {
      return NextResponse.json(
        { error: "finances_enabled must be a boolean" },
        { status: 400 },
      )
    }
    updates.financesEnabled = body.finances_enabled
  }

  if (body.wallet_balance !== undefined) {
    if (
      typeof body.wallet_balance !== "number" ||
      !Number.isFinite(body.wallet_balance) ||
      !Number.isInteger(body.wallet_balance) ||
      body.wallet_balance < 0
    ) {
      return NextResponse.json(
        { error: "wallet_balance must be a non-negative integer" },
        { status: 400 },
      )
    }
    updates.walletBalance = body.wallet_balance
  }

  if (body.bank_balance !== undefined) {
    if (
      typeof body.bank_balance !== "number" ||
      !Number.isFinite(body.bank_balance) ||
      !Number.isInteger(body.bank_balance) ||
      body.bank_balance < 0
    ) {
      return NextResponse.json(
        { error: "bank_balance must be a non-negative integer" },
        { status: 400 },
      )
    }
    updates.bankBalance = body.bank_balance
  }

  // At least one field must be provided
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    )
  }

  // Always bump updated_at
  updates.updatedAt = new Date()

  // Upsert: insert or update on conflict (unique userId)
  const [result] = await db
    .insert(userFinances)
    .values({
      userId:          session.user.id,
      financesEnabled: updates.financesEnabled as boolean | undefined ?? false,
      walletBalance:   updates.walletBalance as number | undefined   ?? 0,
      bankBalance:     updates.bankBalance as number | undefined     ?? 0,
    })
    .onConflictDoUpdate({
      target: userFinances.userId,
      set:    updates as Record<string, unknown>,
    })
    .returning()

  return NextResponse.json({
    finances_enabled: result.financesEnabled,
    wallet_balance:   result.walletBalance,
    bank_balance:     result.bankBalance,
    updated_at:       result.updatedAt.toISOString(),
  })
}
