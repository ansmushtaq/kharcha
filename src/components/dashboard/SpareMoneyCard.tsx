"use client"

import { useState, useEffect } from "react"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { formatPKR } from "@/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Dashboard card showing spare money and owed-to-you.
 *
 * Only rendered if `finances_enabled` is true (parent checks this before
 * rendering; SpareMoneyCard also does its own fetch to confirm).
 *
 * Headline: spare_money = wallet + bank - remaining_budget_this_month
 * Secondary: owed_to_you (separate, never added into spare_money)
 * Expandable breakdown: editable wallet, bank, remaining budget.
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
  const [editingWallet, setEditingWallet] = useState(0)
  const [editingBank, setEditingBank] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")

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
        setEditingWallet(result.wallet_balance ?? 0)
        setEditingBank(result.bank_balance ?? 0)
      } catch {
        if (!cancelled) setError("Network error — could not load finances")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  async function saveBalances() {
    setSaving(true)
    setSaveMsg("")
    try {
      const res = await fetchWithTimeout("/api/finances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_balance: editingWallet, bank_balance: editingBank }),
      })
      if (!res.ok) {
        setSaveMsg("Save failed")
        return
      }
      const result = await res.json()
      setData(result)
      setSaveMsg("Saved")
    } catch {
      setSaveMsg("Network error")
    } finally {
      setSaving(false)
    }
  }

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
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">
            Spare Money
          </h3>
          <p
            className={`text-2xl font-bold tabular-nums ${
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

      {/* Expandable breakdown with inline editing */}
      {expanded && (
        <div className="mt-3 space-y-2 border-t pt-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground shrink-0">Wallet</span>
            <input
              type="number"
              value={editingWallet || ""}
              onChange={(e) => setEditingWallet(Number(e.target.value) || 0)}
              min={0}
              step={1}
              className="w-28 rounded border border-input bg-background px-2 py-1 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground shrink-0">Bank</span>
            <input
              type="number"
              value={editingBank || ""}
              onChange={(e) => setEditingBank(Number(e.target.value) || 0)}
              min={0}
              step={1}
              className="w-28 rounded border border-input bg-background px-2 py-1 text-right text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Remaining budget</span>
            <span className="font-medium">
              {formatPKR(data.remaining_budget_this_month)}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={saveBalances} disabled={saving} size="sm">
              {saving ? "Saving…" : "Update Balances"}
            </Button>
            {saveMsg && (
              <span className={`text-xs ${saveMsg === "Saved" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
