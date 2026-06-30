import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { expenses, userCategories } from "@/lib/schema"
import { eq, and, gte, lte, desc } from "drizzle-orm"
import {
  currentMonth,
  isValidMonth,
  isValidCalendarDate,
  isValidUUID,
  daysInMonth,
} from "@/lib/validation"

const MAX_NOTE_LENGTH = 500

// GET /api/expenses?month=YYYY-MM
// Returns all expenses for the month, joined with category name + color.
// Ordered by date descending (most recent first), then created_at descending.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const rawMonth = searchParams.get("month")
  if (rawMonth && !isValidMonth(rawMonth)) {
    return NextResponse.json({ error: "month must be YYYY-MM format" }, { status: 400 })
  }
  const month = rawMonth ?? currentMonth()

  const startDate = `${month}-01`
  const endDate = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`

  const rows = await db
    .select({
      id: expenses.id,
      userId: expenses.userId,
      categoryId: expenses.categoryId,
      date: expenses.date,
      amount: expenses.amount,
      note: expenses.note,
      createdAt: expenses.createdAt,
      categoryName: userCategories.name,
      categoryColor: userCategories.color,
      categoryType: userCategories.type,
    })
    .from(expenses)
    .leftJoin(
      userCategories,
      and(
        eq(expenses.categoryId, userCategories.id),
        eq(userCategories.userId, session.user.id),
      ),
    )
    .where(
      and(
        eq(expenses.userId, session.user.id),
        gte(expenses.date, startDate),
        lte(expenses.date, endDate),
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.createdAt))

  return NextResponse.json(rows)
}

// POST /api/expenses
// Creates a new expense. Validates amount (positive integer), date (YYYY-MM-DD),
// and category_id (optional, must reference a category owned by the user — both
// 'fixed' and 'variable' types are allowed).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Parse body with try-catch for malformed JSON
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { date, amount, category_id, note } = body

  // Validate date — format AND calendar correctness
  if (!date || typeof date !== "string" || !isValidCalendarDate(date)) {
    return NextResponse.json({ error: "date is required and must be a valid YYYY-MM-DD" }, { status: 400 })
  }

  // Validate amount — PKR whole integer only
  if (amount == null || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive whole number (PKR)" }, { status: 400 })
  }

  // Validate category_id if provided — must be a valid UUID referencing a variable category owned by this user
  if (category_id != null) {
    if (typeof category_id !== "string" || !isValidUUID(category_id)) {
      return NextResponse.json({ error: "category_id must be a valid UUID" }, { status: 400 })
    }

    const [cat] = await db
      .select({ id: userCategories.id, type: userCategories.type })
      .from(userCategories)
      .where(
        and(
          eq(userCategories.id, category_id),
          eq(userCategories.userId, session.user.id),
        ),
      )
      .limit(1)

    if (!cat) {
      return NextResponse.json({ error: "category not found" }, { status: 400 })
    }
  }

  // Validate note if provided
  if (note !== undefined && note !== null) {
    if (typeof note !== "string") {
      return NextResponse.json({ error: "note must be a string" }, { status: 400 })
    }
    if (note.length > MAX_NOTE_LENGTH) {
      return NextResponse.json({ error: `note must be ${MAX_NOTE_LENGTH} characters or fewer` }, { status: 400 })
    }
  }

  const [row] = await db
    .insert(expenses)
    .values({
      userId: session.user.id,
      categoryId: category_id ?? null,
      date,
      amount,
      note: note ?? null,
    })
    .returning()

  return NextResponse.json(row, { status: 201 })
}
