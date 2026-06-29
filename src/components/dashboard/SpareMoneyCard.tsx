"use client"

import { useState, useEffect } from "react"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { ChevronDown, ChevronUp } from "lucide-react"

/**
 * Dashboard card showing spare money and owed-to-you.
 *
 * Only rendered if `finances_enabled` is true (parent checks this before
 * rendering; SpareMoneyCard also does its own fetch to confirm).
 *
 * Headline: spare_money = wallet + bank - remaining_budget_this_month
 * Secondary: owed_to_you (separate, never added into spare_money)
 * Expandable breakdown: wallet, bank, remaining budget.
 *
 * Handles loading, error, empty (disabled), and data states.
 */
export function SpareMoneyCard() {
  const [data, setData] = useState<{
    finances_enabled: boolean
    wallet_balance: number
    bank_balance: number
    remaining_budget_this_month: number
    spare_money: number
    owed_to_you: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetchWithTimeout("/api/finances")
        if (!res.ok) {
          if (!cancelled) setError("Failed to load finances")
          return
        }
        const result = await res.json()
        if (cancelled) return
        setData(result)
      } catch {
        if (!cancelled) setError("Network error — could not load finances")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ── Loading state ──
  if (loading) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="rounded-lg border p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  // ── Disabled / empty state ──
  if (!data || !data.finances_enabled) {
    return null
  }

  // ── Data state ──
  const formatPKR = (n: number) => `PKR ${n.toLocaleString("en-PK")}`

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            Spare Money
          </h3>
          <p
            className={`text-2xl font-bold ${
              data.spare_money >= 0 ? "" : "text-destructive"
            }`}
          >
            {formatPKR(data.spare_money)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={expanded ? "Collapse breakdown" : "Expand breakdown"}
        >
          {expanded ? (
            <ChevronUp className="size-5" />
          ) : (
            <ChevronDown className="size-5" />
          )}
        </button>
      </div>

      {/* Owed to you — always visible, always separate */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Owed to you:</span>
        {data.owed_to_you > 0 ? (
          <span className="text-sm font-semibold">{formatPKR(data.owed_to_you)}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">No loans outstanding</span>
        )}
      </div>

      {/* Expandable breakdown */}
      {expanded && (
        <div className="mt-3 space-y-1.5 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-medium">{formatPKR(data.wallet_balance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bank</span>
            <span className="font-medium">{formatPKR(data.bank_balance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Remaining budget this month
            </span>
            <span className="font-medium">
              {formatPKR(data.remaining_budget_this_month)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
