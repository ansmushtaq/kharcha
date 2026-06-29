import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { loansGiven } from "@/lib/schema"
import { eq, and, desc } from "drizzle-orm"
import { isValidCalendarDate } from "@/lib/validation"

// GET /api/loans?status=outstanding|repaid|all
// Returns loans for the current user, most recent date_lent first.
// Defaults to 'all' if status is omitted or invalid.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "all"

  // Build where clause based on status filter
  const conditions = [eq(loansGiven.userId, session.user.id)]
  if (status === "outstanding") {
    conditions.push(eq(loansGiven.isRepaid, false))
  } else if (status === "repaid") {
    conditions.push(eq(loansGiven.isRepaid, true))
  }
  // 'all' — no additional filter

  const loans = await db
    .select()
    .from(loansGiven)
    .where(and(...conditions))
    .orderBy(desc(loansGiven.dateLent), desc(loansGiven.createdAt))

  return NextResponse.json(
    loans.map((l) => ({
      id:             l.id,
      borrower_name:  l.borrowerName,
      amount:         l.amount,
      date_lent:      l.dateLent,
      is_repaid:      l.isRepaid,
      repaid_at:      l.repaidAt?.toISOString() ?? null,
      note:           l.note,
      created_at:     l.createdAt.toISOString(),
    })),
  )
}

// POST /api/loans
// Create a new loan. Validates required fields and optional note length.
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

  // Validate borrower_name (string, non-empty, max 100 chars)
  if (
    !body.borrower_name ||
    typeof body.borrower_name !== "string" ||
    !body.borrower_name.trim()
  ) {
    return NextResponse.json(
      { error: "borrower_name is required and must be a non-empty string" },
      { status: 400 },
    )
  }
  const borrowerName = (body.borrower_name as string).trim()
  if (borrowerName.length > 100) {
    return NextResponse.json(
      { error: "borrower_name must be at most 100 characters" },
      { status: 400 },
    )
  }

  // Validate amount (positive integer PKR)
  if (
    body.amount === undefined ||
    typeof body.amount !== "number" ||
    !Number.isFinite(body.amount) ||
    !Number.isInteger(body.amount) ||
    body.amount <= 0
  ) {
    return NextResponse.json(
      { error: "amount must be a positive integer (PKR)" },
      { status: 400 },
    )
  }
  const amount = body.amount as number

  // Validate date_lent (YYYY-MM-DD valid calendar date)
  if (!body.date_lent || typeof body.date_lent !== "string") {
    return NextResponse.json(
      { error: "date_lent is required and must be YYYY-MM-DD" },
      { status: 400 },
    )
  }
  if (!isValidCalendarDate(body.date_lent)) {
    return NextResponse.json(
      { error: "date_lent must be a valid calendar date (YYYY-MM-DD)" },
      { status: 400 },
    )
  }
  const dateLent = body.date_lent as string

  // Validate note (optional, max 500 chars)
  let note: string | null = null
  if (body.note !== undefined) {
    if (typeof body.note !== "string") {
      return NextResponse.json(
        { error: "note must be a string" },
        { status: 400 },
      )
    }
    const trimmed = (body.note as string).trim()
    if (trimmed.length > 500) {
      return NextResponse.json(
        { error: "note must be at most 500 characters" },
        { status: 400 },
      )
    }
    note = trimmed || null
  }

  const [loan] = await db
    .insert(loansGiven)
    .values({
      userId:       session.user.id,
      borrowerName: borrowerName,
      amount:       amount,
      dateLent:     dateLent,
      note:         note,
    })
    .returning()

  return NextResponse.json(
    {
      id:            loan.id,
      borrower_name: loan.borrowerName,
      amount:        loan.amount,
      date_lent:     loan.dateLent,
      is_repaid:     loan.isRepaid,
      repaid_at:     null,
      note:          loan.note,
      created_at:    loan.createdAt.toISOString(),
    },
    { status: 201 },
  )
}
