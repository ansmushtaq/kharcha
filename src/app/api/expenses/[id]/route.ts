import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { expenses } from "@/lib/schema"
import { eq, and } from "drizzle-orm"
import { isValidUUID } from "@/lib/validation"

// DELETE /api/expenses/[id]
// Hard delete. Only succeeds if the expense belongs to the current user.
// Single-query ownership check (no SELECT-then-DELETE TOCTOU race).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!isValidUUID(id)) {
    return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Delete with ownership verification in the same query
  const [deleted] = await db
    .delete(expenses)
    .where(
      and(
        eq(expenses.id, id),
        eq(expenses.userId, session.user.id),
      ),
    )
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
