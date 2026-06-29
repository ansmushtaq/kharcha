"use client"

import { Button } from "@/components/ui/button"
import { currentMonth } from "@/lib/validation"

interface Props {
  /** YYYY-MM string for the currently selected month */
  month: string
  /** Called when the user navigates to a different month */
  onChange: (month: string) => void
}

/**
 * Adds `delta` months to a YYYY-MM string. Handles year boundaries.
 * Example: addMonths("2026-01", -1) => "2025-12"
 */
function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number)
  const totalMonths = y * 12 + (m - 1) + delta
  const newYear = Math.floor(totalMonths / 12)
  const newMonth = (totalMonths % 12) + 1
  return `${newYear}-${String(newMonth).padStart(2, "0")}`
}

/** Check whether a YYYY-MM string is on or before the current month. */
function isNotFuture(month: string): boolean {
  return month <= currentMonth()
}

export function MonthPicker({ month, onChange }: Props) {
  const prevMonth = addMonths(month, -1)
  const nextMonth = addMonths(month, 1)
  const canGoNext = isNotFuture(nextMonth)

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onChange(prevMonth)}
        aria-label="Previous month"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Button>

      <span className="text-base font-semibold tabular-nums">{month}</span>

      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onChange(nextMonth)}
        disabled={!canGoNext}
        aria-label="Next month"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Button>
    </div>
  )
}
