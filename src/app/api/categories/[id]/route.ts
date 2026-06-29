import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { userCategories } from "@/lib/schema"
import { eq, and } from "drizzle-orm"

// PATCH /api/categories/[id]
// Update any field: name, fixed_amount, carries_over, is_active, color, sort_order.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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

  const updates: Record<string, unknown> = {}

  // Validate and map each field individually
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 })
    }
    updates.name = body.name.trim()
  }

  // Track resolved type for fixed_amount interaction
  let resolvedType: "fixed" | "variable" | undefined

  if (body.type !== undefined) {
    if (typeof body.type !== "string" || !["fixed", "variable"].includes(body.type)) {
      return NextResponse.json({ error: "type must be 'fixed' or 'variable'" }, { status: 400 })
    }
    resolvedType = body.type as "fixed" | "variable"
    updates.type = resolvedType

    // If changing to variable, clear fixed_amount unless explicitly provided
    if (resolvedType === "variable" && body.fixed_amount === undefined) {
      updates.fixedAmount = null
    }
  }

  if (body.fixed_amount !== undefined) {
    if (typeof body.fixed_amount !== "number" || !Number.isFinite(body.fixed_amount) || body.fixed_amount < 0) {
      return NextResponse.json({ error: "fixed_amount must be a non-negative number" }, { status: 400 })
    }
    updates.fixedAmount = resolvedType === "variable" ? null : body.fixed_amount
  }

  if (body.carries_over !== undefined) updates.carriesOver = !!body.carries_over
  if (body.is_active !== undefined) updates.isActive = !!body.is_active

  if (body.color !== undefined) {
    if (typeof body.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      return NextResponse.json({ error: "color must be a valid hex code (e.g. #e74c3c)" }, { status: 400 })
    }
    updates.color = body.color
  }

  if (body.sort_order !== undefined) {
    if (typeof body.sort_order !== "number" || !Number.isInteger(body.sort_order)) {
      return NextResponse.json({ error: "sort_order must be an integer" }, { status: 400 })
    }
    updates.sortOrder = body.sort_order
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  // Update with ownership check in same query (no TOCTOU)
  const [updated] = await db
    .update(userCategories)
    .set(updates)
    .where(
      and(
        eq(userCategories.id, id),
        eq(userCategories.userId, session.user.id),
      ),
    )
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(updated)
}

// DELETE /api/categories/[id]
// Hard deletes category. Sets category_id = NULL on linked expenses (ON DELETE SET NULL).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Delete with ownership check in same query
  const [deleted] = await db
    .delete(userCategories)
    .where(
      and(
        eq(userCategories.id, id),
        eq(userCategories.userId, session.user.id),
      ),
    )
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
