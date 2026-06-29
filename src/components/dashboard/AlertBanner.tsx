interface Props {
  spent: number
  budget: number
}

/**
 * Shows a warning or danger banner depending on how much of the budget has
 * been spent.
 *
 * | State      | Trigger                   | UI                         |
 * |------------|---------------------------|----------------------------|
 * | On track   | spent < 85% of budget     | Returns null (no banner)   |
 * | Warning    | 85% <= spent < 100%       | Yellow banner with message |
 * | Over budget| spent >= 100%             | Red banner with over-amount|
 */
export function AlertBanner({ spent, budget }: Props) {
  if (budget <= 0) return null

  const percentage = (spent / budget) * 100

  // Over budget (>= 100%)
  if (percentage >= 100) {
    const overBy = spent - budget
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">
          Over Budget!
        </p>
        <p className="mt-1 text-sm text-destructive/90">
          Over budget by PKR {overBy.toLocaleString("en-PK")}
        </p>
      </div>
    )
  }

  // Warning (85% to < 100%)
  if (percentage >= 85) {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
        <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
          Budget Warning
        </p>
        <p className="mt-1 text-sm text-yellow-600/90 dark:text-yellow-400/90">
          You&apos;ve used {Math.round(percentage)}% of your monthly budget
        </p>
      </div>
    )
  }

  // On track — no banner
  return null
}
