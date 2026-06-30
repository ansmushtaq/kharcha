"use client"

import { formatPKR } from "@/lib/utils"

interface Props {
  remainingDailyPool: number
  dailyLimit: number
  effectiveDailyRate: number
  daysRemaining: number
}

/**
 * Daily budget countdown — time-based pool.
 *
 * Each day that passes "consumes" daily_limit from the pool regardless of
 * spending. The remaining pool = (daily_limit × days_remaining) - variable_spent.
 *
 * Shows:
 * - Remaining pool (PKR left for remaining days)
 * - Effective rate (PKR/day going forward)
 * - Progress bar: remaining / future_pool
 *
 * On Day 30 of a perfectly-on-budget month: pool = 1,200, rate = 1,200.
 */
export function DailyProgress({
  remainingDailyPool,
  dailyLimit,
  effectiveDailyRate,
  daysRemaining,
}: Props) {
  // future_pool = what's left after time-based consumption, before spending
  const futurePool = dailyLimit * daysRemaining
  const used = futurePool - remainingDailyPool
  const percentageUsed =
    futurePool > 0 ? Math.min((used / futurePool) * 100, 100) : 0
  const isOver = remainingDailyPool <= 0

  let barColor: string
  let textColor: string
  if (isOver) {
    barColor = "bg-destructive"
    textColor = "text-destructive"
  } else if (percentageUsed >= 85) {
    barColor = "bg-warning"
    textColor = "text-warning"
  } else {
    barColor = "bg-success"
    textColor = "text-success"
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Daily Budget Pool
      </h3>

      <div className="mt-2 flex items-baseline justify-between">
        <span className={`text-xl font-bold tabular-nums ${textColor}`}>
          {formatPKR(remainingDailyPool)}
        </span>
        <span className="text-sm text-muted-foreground">
          remaining of {formatPKR(futurePool)}
        </span>
      </div>

      {/* Progress bar — shrinks as pool is consumed by spending */}
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.max(100 - percentageUsed, 0)}%` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>
          {daysRemaining > 0 ? (
            <>
              Effective rate:{" "}
              <span className={`font-medium tabular-nums ${textColor}`}>
                {formatPKR(effectiveDailyRate)}/day
              </span>
            </>
          ) : (
            "Month ended"
          )}
        </span>
        <span>{daysRemaining} days left</span>
      </div>
    </div>
  )
}
