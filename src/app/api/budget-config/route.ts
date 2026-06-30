import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { userBudgetConfig } from "@/lib/schema"
import { eq } from "drizzle-orm"

// GET /api/budget-config
// Returns { salary, daily_limit } for current user.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [row] = await db
    .select({
      salary: userBudgetConfig.salary,
      dailyLimit: userBudgetConfig.dailyLimit,
    })
    .from(userBudgetConfig)
    .where(eq(userBudgetConfig.userId, session.user.id))
    .limit(1)

  return NextResponse.json({
    salary: row?.salary ?? 0,
    daily_limit: row?.dailyLimit ?? 1200,
  })
}

// PATCH /api/budget-config
// Upserts salary and/or daily_limit for current user.
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { salary, daily_limit } = body

  // Validate provided fields
  if (salary != null && (typeof salary !== "number" || salary < 0 || !Number.isInteger(salary))) {
    return NextResponse.json({ error: "salary must be a non-negative integer" }, { status: 400 })
  }
  if (daily_limit != null && (typeof daily_limit !== "number" || daily_limit < 0 || !Number.isInteger(daily_limit))) {
    return NextResponse.json({ error: "daily_limit must be a non-negative integer" }, { status: 400 })
  }
  if (salary == null && daily_limit == null) {
    return NextResponse.json({ error: "salary or daily_limit required" }, { status: 400 })
  }

  // Get current values as defaults so we can partially update
  const [current] = await db
    .select({
      salary: userBudgetConfig.salary,
      dailyLimit: userBudgetConfig.dailyLimit,
    })
    .from(userBudgetConfig)
    .where(eq(userBudgetConfig.userId, session.user.id))
    .limit(1)

  const newSalary = salary != null ? (salary as number) : (current?.salary ?? 0)
  const newDailyLimit = daily_limit != null ? (daily_limit as number) : (current?.dailyLimit ?? 1200)

  const [row] = await db
    .insert(userBudgetConfig)
    .values({
      userId: session.user.id,
      salary: newSalary,
      dailyLimit: newDailyLimit,
    })
    .onConflictDoUpdate({
      target: userBudgetConfig.userId,
      set: {
        salary: newSalary,
        dailyLimit: newDailyLimit,
        updatedAt: new Date(),
      },
    })
    .returning()

  return NextResponse.json({
    salary: row.salary,
    daily_limit: row.dailyLimit,
  })
}
