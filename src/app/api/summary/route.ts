import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { expenses, userCategories, userBudgetConfig } from "@/lib/schema"
import { eq, and, or, lte, gte, desc, sql, inArray } from "drizzle-orm"
import { currentMonth, isValidMonth, daysInMonth } from "@/lib/validation"
import { daysRemaining, effectiveDailyRate, outstandingBalance } from "@/lib/budget"

// GET /api/summary?month=YYYY-MM
// Returns a full monthly summary scoped to the current user.
// Optimized: 3 parallel DB queries instead of 5 sequential.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const rawMonth = searchParams.get("month")
  if (rawMonth && !isValidMonth(rawMonth)) {
    return NextResponse.json(
      { error: "month must be YYYY-MM format" },
      { status: 400 },
    )
  }
  const month = rawMonth ?? currentMonth()
  const dInMonth = daysInMonth(month)
  const startDate = `${month}-01`
  const endDate = `${month}-${String(dInMonth).padStart(2, "0")}`

  // ── 3 parallel queries ──────────────────────────────────────────────────────
  const userId = session.user.id

  const [budgetConfig, fixedCategories, allExpenses] = await Promise.all([
    // 1. Budget config (1 row)
    db
      .select({
        salary: userBudgetConfig.salary,
        dailyLimit: userBudgetConfig.dailyLimit,
      })
      .from(userBudgetConfig)
      .where(eq(userBudgetConfig.userId, userId))
      .limit(1),

    // 2. Visible fixed categories for the month
    db
      .select({
        id: userCategories.id,
        name: userCategories.name,
        fixedAmount: userCategories.fixedAmount,
        carriesOver: userCategories.carriesOver,
        createdForMonth: userCategories.createdForMonth,
      })
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
      .orderBy(userCategories.sortOrder, userCategories.name),

    // 3. ALL expenses for this user with category join — one query covers
    //    variable_spent, total_spent, variable breakdown, and fixed payments
    db
      .select({
        amount: expenses.amount,
        date: expenses.date,
        categoryId: expenses.categoryId,
        categoryName: userCategories.name,
        categoryColor: userCategories.color,
        categoryType: userCategories.type,
      })
      .from(expenses)
      .leftJoin(
        userCategories,
        and(
          eq(expenses.categoryId, userCategories.id),
          eq(userCategories.userId, userId),
        ),
      )
      .where(eq(expenses.userId, userId)),
  ])

  const salary = budgetConfig[0]?.salary ?? 0
  const dailyLimit = budgetConfig[0]?.dailyLimit ?? 1200
  const coerce = (v: unknown): number => Number(v) || 0

  // ── Compute everything from the single expense result set ───────────────────

  // Split expenses into current-month and all-time
  const monthExpenses = allExpenses.filter(
    (e) => e.date >= startDate && e.date <= endDate,
  )

  // Variable spent this month
  const variableSpent = monthExpenses
    .filter((e) => e.categoryType === "variable")
    .reduce((sum, e) => sum + e.amount, 0)

  // Total spent this month (all expenses)
  const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0)

  // Variable breakdown — group by category in JS instead of another DB query
  const varBreakdownMap: Record<string, { categoryId: string; name: string; color: string | null; total: number }> = {}
  for (const e of monthExpenses) {
    if (e.categoryType !== "variable" || !e.categoryId) continue
    const key = e.categoryId
    if (!varBreakdownMap[key]) {
      varBreakdownMap[key] = {
        categoryId: e.categoryId,
        name: e.categoryName ?? "Unknown",
        color: e.categoryColor ?? null,
        total: 0,
      }
    }
    varBreakdownMap[key].total += e.amount
  }
  const variableBreakdown = Object.values(varBreakdownMap).sort(
    (a, b) => b.total - a.total,
  )

  // Pool countdown
  const totalDailyPool = dailyLimit * dInMonth
  const today = new Date()
  const daysRemainingThisMonth =
    month === currentMonth() ? daysRemaining(month, today) : 0
  const futurePool = dailyLimit * daysRemainingThisMonth
  const remainingDailyPool = Math.max(futurePool - variableSpent, 0)
  const effRate = effectiveDailyRate(remainingDailyPool, daysRemainingThisMonth)

  // Fixed category payments — use ALL expenses (not just current month)
  const fixedCatIds = new Set(fixedCategories.map((c) => c.id))
  const paymentsPerMonth: Record<string, Record<string, number>> = {}
  const paidByCategory: Record<string, number> = {}
  for (const e of allExpenses) {
    if (!e.categoryId || !fixedCatIds.has(e.categoryId)) continue
    const payMonth = (e.date as string).slice(0, 7)
    if (!paymentsPerMonth[e.categoryId]) paymentsPerMonth[e.categoryId] = {}
    paymentsPerMonth[e.categoryId][payMonth] =
      (paymentsPerMonth[e.categoryId][payMonth] ?? 0) + e.amount
    if (payMonth === month) {
      paidByCategory[e.categoryId] =
        (paidByCategory[e.categoryId] ?? 0) + e.amount
    }
  }

  // Rolling outstanding balance per fixed category
  const fixedCategoriesWithBalance = fixedCategories.map((c) => ({
    id: c.id,
    name: c.name,
    fixed_amount: c.fixedAmount ?? 0,
    paid_this_month: paidByCategory[c.id] ?? 0,
    outstanding_balance: outstandingBalance(
      c.fixedAmount ?? 0,
      c.createdForMonth,
      paymentsPerMonth[c.id] ?? {},
      month,
    ),
    carries_over: c.carriesOver,
  }))

  const totalFixedBudget = fixedCategories.reduce(
    (sum, c) => sum + (c.fixedAmount ?? 0),
    0,
  )
  const totalBudget = totalFixedBudget + totalDailyPool

  return NextResponse.json({
    month,
    salary,
    days_in_month: dInMonth,
    daily_limit: dailyLimit,
    total_daily_pool: totalDailyPool,
    variable_spent: variableSpent,
    remaining_daily_pool: remainingDailyPool,
    days_remaining: daysRemainingThisMonth,
    effective_daily_rate: effRate,
    total_fixed_budget: totalFixedBudget,
    total_budget: totalBudget,
    total_spent: totalSpent,
    over_under: totalSpent - totalBudget,
    fixed_categories: fixedCategoriesWithBalance,
    variable_breakdown: variableBreakdown.map((b) => ({
      category_id: b.categoryId,
      name: b.name,
      color: b.color,
      total: b.total,
    })),
  })
}
