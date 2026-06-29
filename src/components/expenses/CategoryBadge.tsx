"use client"

interface Props {
  name: string | null
  color: string | null
}

/**
 * Colored pill showing the category name.
 * When name is null (deleted category with SET NULL), displays "Uncategorized"
 * in muted styling. Otherwise uses the category's color as a background tint.
 */
const HEX_RE = /^#[0-9a-fA-F]{6}$/

function safeHex(c: string | null): string | null {
  return c && HEX_RE.test(c) ? c : null
}

export function CategoryBadge({ name, color }: Props) {
  if (!name) {
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Uncategorized
      </span>
    )
  }

  const validColor = safeHex(color)

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: validColor ? `${validColor}20` : undefined,
        color: validColor ?? undefined,
      }}
    >
      {name}
    </span>
  )
}
