import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { userCategories } from "@/lib/schema"
import { eq, and, or, lte } from "drizzle-orm"
import { currentMonth, isValidMonth } from "@/lib/validation"

// GET /api/categories?month=YYYY-MM&all=true
// ?all=true   → return ALL categories for this user (settings page)
// ?month=...  → apply visibility rule for that month (expense form, dashboard)
// Defaults to current month with visibility rule if neither is set.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const showAll = searchParams.get("all") === "true"

  if (showAll) {
    const rows = await db
      .select()
      .from(userCategories)
      .where(eq(userCategories.userId, session.user.id))
      .orderBy(userCategories.sortOrder, userCategories.name)
    return NextResponse.json(rows)
  }

  const rawMonth = searchParams.get("month")
  if (rawMonth && !isValidMonth(rawMonth)) {
    return NextResponse.json({ error: "month must be YYYY-MM format" }, { status: 400 })
  }
  const month = rawMonth ?? currentMonth()

  // Visibility rule:
  // (carries_over = true AND created_for_month <= M)
  // OR (carries_over = false AND created_for_month = M)
  // AND is_active = true
  const rows = await db
    .select()
    .from(userCategories)
    .where(
      and(
        eq(userCategories.userId, session.user.id),
        eq(userCategories.isActive, true),
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

  return NextResponse.json(rows)
}

// POST /api/categories
// Creates a new category. Sets created_for_month to current month server-side.
export async function POST(req: NextRequest) {
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

  const { name, type, fixed_amount, carries_over, color } = body

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  if (typeof type !== "string" || !["fixed", "variable"].includes(type)) {
    return NextResponse.json({ error: "type must be 'fixed' or 'variable'" }, { status: 400 })
  }

  if (type === "fixed") {
    if (fixed_amount == null || typeof fixed_amount !== "number" || !Number.isFinite(fixed_amount) || fixed_amount < 0) {
      return NextResponse.json({ error: "fixed_amount must be a non-negative number for fixed categories" }, { status: 400 })
    }
  }

  // Validate color format if provided
  if (color != null && (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))) {
    return NextResponse.json({ error: "color must be a valid hex code (e.g. #e74c3c)" }, { status: 400 })
  }

  // All fields validated — extract clean typed values
  const cleanName = (name as string).trim()
  const cleanType: "fixed" | "variable" = type as "fixed" | "variable"
  const cleanAmount = cleanType === "fixed" ? (fixed_amount as number) : null
  const cleanCarriesOver = carries_over == null ? true : !!carries_over
  const cleanColor: string | null = (color as string | null) ?? null

  const [row] = await db
    .insert(userCategories)
    .values({
      userId: session.user.id,
      name: cleanName,
      type: cleanType,
      fixedAmount: cleanAmount,
      carriesOver: cleanCarriesOver,
      color: cleanColor,
      createdForMonth: currentMonth(),
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
