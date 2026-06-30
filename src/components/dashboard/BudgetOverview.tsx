"use client"

import { formatPKR } from "@/lib/utils"

interface Props {
  spent: number
  budget: number
}

/**
 * Circular progress ring showing total_spent / total_budget.
 *
 * - Green when spent < 85% of budget
 * - Yellow (warning) when spent is 85-100%
 * - Red (destructive) when spent >= 100%
 *
 * Uses SVG circles with stroke-dasharray / stroke-dashoffset for the progress
 * arc. No charting library needed — just CSS and SVG.
 */
const SIZE = 160
const STROKE_WIDTH = 12
const RADIUS = (SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function BudgetOverview({ spent, budget }: Props) {
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const isOverBudget = spent >= budget

  // Colour coding: success -> warning -> destructive
  let ringColorClass: string
  let labelColor: string
  if (isOverBudget) {
    ringColorClass = "stroke-destructive"
    labelColor = "text-destructive"
  } else if (percentage >= 85) {
    ringColorClass = "stroke-warning"
    labelColor = "text-warning"
  } else {
    ringColorClass = "stroke-success"
    labelColor = "text-success"
  }

  const offset = CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Budget Overview
      </h3>

      <div className="flex flex-col items-center">
        {/* SVG ring */}
        <div className="relative flex items-center justify-center">
          <svg
            width={SIZE}
            height={SIZE}
            className="-rotate-90"
            aria-label={`${Math.round(percentage)} percent of budget used`}
          >
            {/* Background track */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH}
              className="text-muted"
            />
            {/* Progress arc */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className={`transition-all duration-500 ${ringColorClass}`}
            />
          </svg>

          {/* Centre label */}
          <div className="absolute flex flex-col items-center">
            <span className={`text-2xl font-bold ${labelColor}`}>
              {Math.round(percentage)}%
            </span>
            <span className="text-xs text-muted-foreground">
              {formatPKR(spent)} / <span className="tabular-nums">{formatPKR(budget)}</span>
            </span>
          </div>
        </div>

        {/* Under / over indicator */}
        <p className="mt-2 text-sm text-muted-foreground">
          {percentage >= 100
            ? `Over by ${formatPKR(spent - budget)}`
            : `Under by ${formatPKR(budget - spent)}`}
        </p>
      </div>
    </div>
  )
}
