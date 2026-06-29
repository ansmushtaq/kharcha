"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { currentMonth } from "@/lib/validation"
import { MonthPicker } from "@/components/history/MonthPicker"
import { MonthlySummaryCard } from "@/components/history/MonthlySummaryCard"
import { CategoryBreakdownChart } from "@/components/history/CategoryBreakdownChart"
import { FixedCategoriesSummary } from "@/components/history/FixedCategoriesSummary"

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

/** Skeleton placeholder matching card dimensions. */
function CardSkeleton() {
  return <div className="h-48 animate-pulse rounded-lg bg-muted" />
}

export default function HistoryPage() {
  const [month, setMonth] = useState(() => currentMonth())
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchSummary = useCallback(async (selectedMonth: string) => {
    setLoading(true)
    setError("")
    try {
      const res = await fetchWithTimeout(
        `/api/summary?month=${encodeURIComponent(selectedMonth)}`,
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || "Failed to load history data")
        return
      }
      const data: Summary = await res.json()
      setSummary(data)
    } catch {
      setError("Network error — could not load history data")
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchSummary(month)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Handle month change from the picker. */
  const handleMonthChange = useCallback(
    (newMonth: string) => {
      setMonth(newMonth)
      fetchSummary(newMonth)
    },
    [fetchSummary],
  )

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-4">
        <MonthPicker month={month} onChange={handleMonthChange} />
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            onClick={() => fetchSummary(month)}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // ── Empty / null state (guard) ─────────────────────────────────────────────
  if (!summary) {
    return (
      <div className="space-y-4">
        <MonthPicker month={month} onChange={handleMonthChange} />
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-sm text-muted-foreground">No activity this month</p>
          <Button
            variant="outline"
            onClick={() => fetchSummary(month)}
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // ── Data state ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">History</h1>

      <MonthPicker month={month} onChange={handleMonthChange} />

      <MonthlySummaryCard summary={summary} />

      <CategoryBreakdownChart breakdown={summary.variable_breakdown} />

      <FixedCategoriesSummary categories={summary.fixed_categories} />
    </div>
  )
}
