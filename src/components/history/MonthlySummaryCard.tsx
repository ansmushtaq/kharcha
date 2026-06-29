"use client"

interface FixedCategory {
  id: string
  name: string
  amount: number
  carries_over: boolean
}

interface VariableBreakdownEntry {
  category_id: string
  name: string
  color: string | null
  total: number
}

interface Summary {
  month: string
  days_in_month: number
  daily_limit: number
  total_daily_budget: number
  total_fixed_budget: number
  total_budget: number
  total_variable_spent: number
  total_spent: number
  today_spent: number
  over_under: number
  fixed_categories: FixedCategory[]
  variable_breakdown: VariableBreakdownEntry[]
}

interface Props {
  summary: Summary
}

/** PKR whole-number formatting — matches BudgetOverview pattern. */
function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString("en-PK")}`
}

export function MonthlySummaryCard({ summary }: Props) {
  const { total_budget: budget, total_spent: spent, over_under } = summary

  const isOverBudget = over_under > 0
  const dailyAvg =
    summary.days_in_month > 0
      ? Math.round(summary.total_variable_spent / summary.days_in_month)
      : 0

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Monthly Summary
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Total budget */}
        <div>
          <p className="text-xs text-muted-foreground">Total Budget</p>
          <p className="text-lg font-bold">{formatPKR(budget)}</p>
          <p className="text-xs text-muted-foreground">
            Fixed {formatPKR(summary.total_fixed_budget)} + Daily{" "}
            {formatPKR(summary.total_daily_budget)}
          </p>
        </div>

        {/* Total spent */}
        <div>
          <p className="text-xs text-muted-foreground">Total Spent</p>
          <p className="text-lg font-bold">{formatPKR(spent)}</p>
        </div>
      </div>

      {/* Over / under delta */}
      <div
        className={`mt-3 rounded-md px-3 py-2 text-sm font-medium ${
          isOverBudget
            ? "bg-destructive/10 text-destructive"
            : "bg-green-50 text-green-700"
        }`}
      >
        {isOverBudget
          ? `Over budget by ${formatPKR(over_under)}`
          : `Under budget by ${formatPKR(Math.abs(over_under))}`}
      </div>

      {/* Daily average variable spend */}
      <div className="mt-3">
        <p className="text-xs text-muted-foreground">
          Daily Average Variable Spend
        </p>
        <p className="text-base font-semibold">{formatPKR(dailyAvg)}</p>
        <p className="text-xs text-muted-foreground">
          across {summary.days_in_month} days
        </p>
      </div>
    </div>
  )
}
