"use client"

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatPKR, safeHex } from "@/lib/utils"

interface BreakdownEntry {
  category_id: string
  name: string
  color: string | null
  total: number
}

interface Props {
  breakdown: BreakdownEntry[]
}

/** Fallback colors via CSS chart vars — defined in globals.css (Ledger theme). */
const FALLBACK_COLORS = [
  "var(--chart-1)", // teal
  "var(--chart-2)", // marigold
  "var(--chart-3)", // coral
  "var(--chart-4)", // plum
  "var(--chart-5)", // sky
]

/**
 * Custom tooltip that shows the category name and PKR amount.
 */
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[]
}) {
  if (!active || !payload || payload.length === 0) return null

  const entry = payload[0]
  const name = entry.name as string
  const value = entry.value as number

  return (
    <div className="rounded-md border bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">{formatPKR(value)}</p>
    </div>
  )
}

export function CategoryBreakdownChart({ breakdown }: Props) {
  // Filter out entries with zero total (nothing to chart)
  const data = breakdown.filter((b) => b.total > 0)

  // ── Empty state ─────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">
          Spending by Category
        </h3>
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">
            No variable expenses this month
          </p>
        </div>
      </div>
    )
  }

  // ── Data state ──────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Spending by Category
      </h3>

      <div className="flex flex-col items-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry, index) => {
                const fill = safeHex(entry.color) ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                return <Cell key={entry.category_id} fill={fill} />
              })}
            </Pie>
            <Tooltip
              content={(props: unknown) => <ChartTooltip {...(props as object)} />}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Legend: category name + total */}
        <div className="mt-3 grid w-full grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {data.map((entry, index) => {
            const dotColor =
              safeHex(entry.color) ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]
            return (
              <div key={entry.category_id} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="truncate">{entry.name}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {formatPKR(entry.total)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
