import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { expenses, userCategories, userBudgetConfig } from "@/lib/schema"
import { eq, and, or, lte, gte, desc, sql } from "drizzle-orm"
import { currentMonth, isValidMonth, daysInMonth } from "@/lib/validation"

// GET /api/summary?month=YYYY-MM
// Returns a monthly budget summary scoped to the current user.
// Defaults to the current month if month is omitted.
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

  // 1. Fetch daily_limit from user_budget_config (default 1200)
  const [budgetConfig] = await db
    .select({ dailyLimit: userBudgetConfig.dailyLimit })
    .from(userBudgetConfig)
    .where(eq(userBudgetConfig.userId, session.user.id))
    .limit(1)
  const dailyLimit = budgetConfig?.dailyLimit ?? 1200

  // 2. Fetch visible fixed categories for the month
  // Visibility: (carries_over=true AND created_for_month <= M)
  //             OR (carries_over=false AND created_for_month = M)
  //             AND is_active = true
  const fixedCategories = await db
    .select({
      id: userCategories.id,
      name: userCategories.name,
      amount: userCategories.fixedAmount,
      carriesOver: userCategories.carriesOver,
    })
    .from(userCategories)
    .where(
      and(
        eq(userCategories.userId, session.user.id),
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
    .orderBy(userCategories.sortOrder, userCategories.name)

  // 3. Compute budget totals
  const totalFixedBudget = fixedCategories.reduce(
    (sum, c) => sum + (c.amount ?? 0),
    0,
  )
  const totalDailyBudget = dailyLimit * dInMonth
  const totalBudget = totalFixedBudget + totalDailyBudget

  // 4. Total spent for the month (all expenses)
  const [totalSpentResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, session.user.id),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate),
      ),
    )
  const totalSpent = totalSpentResult?.total ?? 0

  // 5. Variable breakdown — group expenses by variable category
  const variableBreakdown = await db
    .select({
      categoryId: userCategories.id,
      name: userCategories.name,
      color: userCategories.color,
      total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .innerJoin(
      userCategories,
      and(
        eq(expenses.categoryId, userCategories.id),
        eq(userCategories.userId, session.user.id),
        eq(userCategories.type, "variable"),
      ),
    )
    .where(
      and(
        eq(expenses.userId, session.user.id),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate),
      ),
    )
    .groupBy(userCategories.id, userCategories.name, userCategories.color)
    .orderBy(desc(sql`COALESCE(SUM(${expenses.amount}), 0)`))

  // 6. Today's spending (for the DailyProgress component)
  const todayDate = new Date().toISOString().slice(0, 10)
  const [todayResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}), 0)` })
    .from(expenses)
    .where(
      and(
        eq(expenses.userId, session.user.id),
        eq(expenses.date, todayDate),
      ),
    )
  const todaySpent = todayResult?.total ?? 0

  const overUnder = totalSpent - totalBudget

  // Coerce SUM results to numbers — postgres driver may return strings
  const coerce = (v: unknown): number => Number(v) || 0

  return NextResponse.json({
    month,
    days_in_month: dInMonth,
    daily_limit: dailyLimit,
    total_daily_budget: totalDailyBudget,
    total_fixed_budget: totalFixedBudget,
    total_budget: totalBudget,
    total_variable_spent: coerce(totalSpent),
    total_spent: coerce(totalSpent),
    today_spent: coerce(todaySpent),
    over_under: coerce(totalSpent) - totalBudget,
    fixed_categories: fixedCategories.map((c) => ({
      id: c.id,
      name: c.name,
      amount: c.amount ?? 0,
      carries_over: c.carriesOver,
    })),
    variable_breakdown: variableBreakdown.map((b) => ({
      category_id: b.categoryId,
      name: b.name,
      color: b.color,
      total: coerce(b.total),
    })),
  })
}
