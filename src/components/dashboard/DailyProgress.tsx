"use client"

interface Props {
  spent: number
  dailyLimit: number
}

/**
 * Today's spending vs daily_limit.
 *
 * Shows a horizontal progress bar with remaining / over-by label.
 * - Green bar if spent < 85% of daily limit
 * - Yellow bar if 85-100%
 * - Red bar if over the daily limit
 */
function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString("en-PK")}`
}

export function DailyProgress({ spent, dailyLimit }: Props) {
  const percentage =
    dailyLimit > 0 ? Math.min((spent / dailyLimit) * 100, 100) : 0
  const remaining = Math.max(dailyLimit - spent, 0)
  const isOver = spent > dailyLimit

  let barColor: string
  if (isOver) {
    barColor = "bg-destructive"
  } else if (percentage >= 85) {
    barColor = "bg-yellow-500"
  } else {
    barColor = "bg-green-500"
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Today&apos;s Spending
      </h3>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-xl font-bold">{formatPKR(spent)}</span>
        <span className="text-sm text-muted-foreground">
          of {formatPKR(dailyLimit)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Remaining / over indicator */}
      {isOver ? (
        <p className="mt-1 text-xs text-destructive">
          Over daily limit by {formatPKR(spent - dailyLimit)}
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatPKR(remaining)} remaining today
        </p>
      )}
    </div>
  )
}
