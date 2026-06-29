"use client"

import { useState, useEffect, useCallback } from "react"
import { Trash2 } from "lucide-react"
import { CategoryBadge } from "@/components/expenses/CategoryBadge"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"

interface ExpenseRow {
  id: string
  userId: string
  categoryId: string | null
  date: string
  amount: number
  note: string | null
  createdAt: string
  categoryName: string | null
  categoryColor: string | null
}

interface GroupedExpenses {
  [date: string]: ExpenseRow[]
}

interface Props {
  /** Callback to trigger a refresh. Parent can change this key to force re-fetch. */
  refreshKey: number
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function formatPKR(n: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(n)
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffTime = today.getTime() - d.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }

  if (diffDays === 0) return "Today " + d.toLocaleDateString("en-US", options)
  if (diffDays === 1) return "Yesterday " + d.toLocaleDateString("en-US", options)
  return d.toLocaleDateString("en-US", options)
}

export function ExpenseList({ refreshKey }: Props) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const month = currentMonth()
      const res = await fetchWithTimeout(`/api/expenses?month=${month}`)
      if (!res.ok) {
        setError("Failed to load expenses")
        return
      }
      const data: ExpenseRow[] = await res.json()
      setExpenses(data)
    } catch {
      setError("Network error — could not load expenses")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses, refreshKey])

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return
    setDeletingId(id)
    try {
      const res = await fetchWithTimeout(`/api/expenses/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id))
      } else {
        const d = await res.json()
        setError(d.error || "Failed to delete")
      }
    } catch {
      setError("Network error — could not delete")
    } finally {
      setDeletingId(null)
    }
  }

  // Group expenses by date (already sorted desc from API)
  const grouped: GroupedExpenses = {}
  for (const exp of expenses) {
    if (!grouped[exp.date]) grouped[exp.date] = []
    grouped[exp.date].push(exp)
  }

  // Compute daily totals
  const dailyTotals: Record<string, number> = {}
  for (const [date, exps] of Object.entries(grouped)) {
    dailyTotals[date] = exps.reduce((sum, e) => sum + e.amount, 0)
  }

  // Loading state
  if (loading && expenses.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="font-semibold">Expenses</h2>
        <p className="text-sm text-muted-foreground">Loading expenses…</p>
      </div>
    )
  }

  // Error state (only show if no data at all)
  if (error && expenses.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="font-semibold">Expenses</h2>
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" variant="outline" onClick={fetchExpenses}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Expenses</h2>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Empty state */}
      {Object.keys(grouped).length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          No expenses logged this month. Add one above to get started.
        </p>
      )}

      {/* Grouped expense list */}
      {Object.entries(grouped).map(([date, exps]) => (
        <div key={date}>
          {/* Date header with running total */}
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">
              {formatDateHeading(date)}
            </h3>
            <span className="text-sm font-semibold">
              {formatPKR(dailyTotals[date])}
            </span>
          </div>

          {/* Entries for this date */}
          <div className="space-y-1">
            {exps.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                {/* Category badge */}
                <div className="shrink-0">
                  <CategoryBadge
                    name={exp.categoryName}
                    color={exp.categoryColor}
                  />
                </div>

                {/* Note & meta */}
                <div className="min-w-0 flex-1">
                  {exp.note ? (
                    <p className="truncate text-sm">{exp.note}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No note
                    </p>
                  )}
                </div>

                {/* Amount */}
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatPKR(exp.amount)}
                </span>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDelete(exp.id)}
                  disabled={deletingId === exp.id}
                  className="inline-flex items-center justify-center shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50 min-h-[44px] min-w-[44px]"
                  title="Delete expense"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
