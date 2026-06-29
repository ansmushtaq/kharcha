interface FixedCategory {
  id: string
  name: string
  amount: number
  carries_over: boolean
}

interface Props {
  categories: FixedCategory[]
}

function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString("en-PK")}`
}

/**
 * Lists the user's active fixed categories visible this month with their amounts.
 * Shows an empty state when no fixed categories exist.
 */
export function FixedCategoriesList({ categories }: Props) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Fixed Categories
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No fixed categories set up yet. Add them in Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        Fixed Categories
      </h3>
      <ul className="divide-y divide-border">
        {categories.map((cat) => (
          <li
            key={cat.id}
            className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
          >
            <span className="text-sm">{cat.name}</span>
            <span className="text-sm font-medium">{formatPKR(cat.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
