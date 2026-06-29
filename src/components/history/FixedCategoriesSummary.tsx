"use client"

interface FixedCategory {
  id: string
  name: string
  amount: number
  carries_over: boolean
}

interface Props {
  categories: FixedCategory[]
}

/** PKR whole-number formatting. */
function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString("en-PK")}`
}

export function FixedCategoriesSummary({ categories }: Props) {
  // ── Empty state ─────────────────────────────────────────────────────
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Fixed Categories
        </h3>
        <div className="flex items-center justify-center py-4">
          <p className="text-sm text-muted-foreground">
            No fixed categories this month
          </p>
        </div>
      </div>
    )
  }

  // ── Data state ──────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Fixed Categories
      </h3>

      <div className="divide-y">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{cat.name}</span>
              {cat.carries_over && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  recurring
                </span>
              )}
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {formatPKR(cat.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
