import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { userBudgetConfig } from "@/lib/schema"
import { eq } from "drizzle-orm"

// GET /api/budget-config
// Returns { daily_limit } for current user.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [row] = await db
    .select({ dailyLimit: userBudgetConfig.dailyLimit })
    .from(userBudgetConfig)
    .where(eq(userBudgetConfig.userId, session.user.id))
    .limit(1)

  return NextResponse.json({
    daily_limit: row?.dailyLimit ?? 1200,
  })
}

// PATCH /api/budget-config
// Upserts daily_limit for current user.
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { daily_limit } = body

  if (daily_limit == null || typeof daily_limit !== "number" || daily_limit < 0) {
    return NextResponse.json({ error: "daily_limit must be a non-negative number" }, { status: 400 })
  }

  const [row] = await db
    .insert(userBudgetConfig)
    .values({
      userId: session.user.id,
      dailyLimit: daily_limit,
    })
    .onConflictDoUpdate({
      target: userBudgetConfig.userId,
      set: { dailyLimit: daily_limit, updatedAt: new Date() },
    })
    .returning()

  return NextResponse.json({ daily_limit: row.dailyLimit })
}
