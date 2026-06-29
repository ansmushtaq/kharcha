import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { loansGiven } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { isValidCalendarDate, isValidUUID } from "@/lib/validation"

// PATCH /api/loans/[id]
// Edit any field on a loan, or mark it repaid.
// When is_repaid flips to true, repaid_at is set server-side to now().
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate UUID before touching the database
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  // Validate borrower_name
  if (body.borrower_name !== undefined) {
    if (
      typeof body.borrower_name !== "string" ||
      !(body.borrower_name as string).trim()
    ) {
      return NextResponse.json(
        { error: "borrower_name must be a non-empty string" },
        { status: 400 },
      )
    }
    const trimmed = (body.borrower_name as string).trim()
    if (trimmed.length > 100) {
      return NextResponse.json(
        { error: "borrower_name must be at most 100 characters" },
        { status: 400 },
      )
    }
    updates.borrowerName = trimmed
  }

  // Validate amount
  if (body.amount !== undefined) {
    if (
      typeof body.amount !== "number" ||
      !Number.isFinite(body.amount) ||
      !Number.isInteger(body.amount) ||
      (body.amount as number) <= 0
    ) {
      return NextResponse.json(
        { error: "amount must be a positive integer (PKR)" },
        { status: 400 },
      )
    }
    updates.amount = body.amount
  }

  // Validate date_lent
  if (body.date_lent !== undefined) {
    if (typeof body.date_lent !== "string" || !isValidCalendarDate(body.date_lent)) {
      return NextResponse.json(
        { error: "date_lent must be a valid calendar date (YYYY-MM-DD)" },
        { status: 400 },
      )
    }
    updates.dateLent = body.date_lent
  }

  // Validate note
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
    updates.note = trimmed || null
  }

  // Handle is_repaid → repaid_at logic
  if (body.is_repaid !== undefined) {
    if (typeof body.is_repaid !== "boolean") {
      return NextResponse.json(
        { error: "is_repaid must be a boolean" },
        { status: 400 },
      )
    }

    if (body.is_repaid) {
      // Flipping to repaid: set is_repaid = true and repaid_at = now()
      updates.isRepaid = true
      updates.repaidAt = new Date()
    } else {
      // Un-repaying: clear is_repaid and repaid_at
      updates.isRepaid = false
      updates.repaidAt = null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    )
  }

  // Single-query ownership check: only update if loan belongs to current user
  const [updated] = await db
    .update(loansGiven)
    .set(updates)
    .where(
      and(
        eq(loansGiven.id, id),
        eq(loansGiven.userId, session.user.id),
      ),
    )
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    id:            updated.id,
    borrower_name: updated.borrowerName,
    amount:        updated.amount,
    date_lent:     updated.dateLent,
    is_repaid:     updated.isRepaid,
    repaid_at:     updated.repaidAt?.toISOString() ?? null,
    note:          updated.note,
    created_at:    updated.createdAt.toISOString(),
  })
}

// DELETE /api/loans/[id]
// Hard delete, ownership-verified in a single query.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate UUID before touching the database
  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 })
  }

  // Delete with ownership check in same query
  const [deleted] = await db
    .delete(loansGiven)
    .where(
      and(
        eq(loansGiven.id, id),
        eq(loansGiven.userId, session.user.id),
      ),
    )
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
