"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { BudgetOverview } from "@/components/dashboard/BudgetOverview"
import { DailyProgress } from "@/components/dashboard/DailyProgress"
import { FixedCategoriesList } from "@/components/dashboard/FixedCategoriesList"
import { QuickAddForm } from "@/components/dashboard/QuickAddForm"
import { AlertBanner } from "@/components/dashboard/AlertBanner"
import { SpareMoneyCard } from "@/components/dashboard/SpareMoneyCard"

interface FixedCategory {
  id: string
  name: string
  fixed_amount: number
  paid_this_month: number
  outstanding_balance: number
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
  salary: number
  additional_income: number
  days_in_month: number
  daily_limit: number
  total_daily_pool: number
  variable_spent: number
  remaining_daily_pool: number
  days_remaining: number
  effective_daily_rate: number
  total_fixed_budget: number
  total_budget: number
  total_spent: number
  total_consumed: number
  over_under: number
  fixed_categories: FixedCategory[]
  variable_breakdown: VariableBreakdownEntry[]
}

/** Skeleton placeholder matching card dimensions. */
function CardSkeleton() {
  return <div className="h-48 animate-pulse rounded-lg bg-muted" />
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetchWithTimeout("/api/summary")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || "Failed to load dashboard data")
        return
      }
      const data: Summary = await res.json()
      setSummary(data)
    } catch {
      setError("Network error — could not load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <CardSkeleton />
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-36 animate-pulse rounded-lg bg-muted" />
        <div className="h-44 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchSummary}>
          Retry
        </Button>
      </div>
    )
  }

  // ── Empty / null state (shouldn't normally happen, but guard anyway) ───────
  if (!summary) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-muted-foreground">No data available</p>
        <Button variant="outline" onClick={fetchSummary}>
          Retry
        </Button>
      </div>
    )
  }

  // ── Data state ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{summary.month}</p>
      </div>

      <AlertBanner spent={summary.total_consumed} budget={summary.total_budget} />

      <BudgetOverview spent={summary.total_consumed} budget={summary.total_budget} />

      <DailyProgress
        remainingDailyPool={summary.remaining_daily_pool}
        dailyLimit={summary.daily_limit}
        effectiveDailyRate={summary.effective_daily_rate}
        daysRemaining={summary.days_remaining}
      />

      <FixedCategoriesList categories={summary.fixed_categories} onPaid={fetchSummary} />

      {/* SpareMoneyCard — only rendered if finances_enabled is true (handles its own fetch + check) */}
      <SpareMoneyCard />

      <QuickAddForm onSaved={fetchSummary} />
    </div>
  )
}
