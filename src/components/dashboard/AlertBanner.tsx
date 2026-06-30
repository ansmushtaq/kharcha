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
 * | Warning    | 85% <= spent < 100%       | bg-warning/text-warning-fg |
 * | Over budget| spent >= 100%             | bg-destructive/text-dest-fg|
 */
export function AlertBanner({ spent, budget }: Props) {
  if (budget <= 0) return null

  const percentage = (spent / budget) * 100

  // Over budget (>= 100%)
  if (percentage >= 100) {
    const overBy = spent - budget
    return (
      <div className="rounded-lg bg-destructive p-4 text-destructive-foreground">
        <p className="text-sm font-medium">Over Budget!</p>
        <p className="mt-1 text-sm">
          Over budget by PKR {overBy.toLocaleString("en-PK")}
        </p>
      </div>
    )
  }

  // Warning (85% to < 100%)
  if (percentage >= 85) {
    return (
      <div className="rounded-lg bg-warning p-4 text-warning-foreground">
        <p className="text-sm font-medium">Budget Warning</p>
        <p className="mt-1 text-sm">
          You&apos;ve used {Math.round(percentage)}% of your monthly budget
        </p>
      </div>
    )
  }

  // On track — no banner
  return null
}
