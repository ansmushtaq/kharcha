"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LoansTable } from "@/components/settings/LoansTable"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"

/**
 * Finances section — one card, three states:
 *
 * 1. Loading — skeleton
 * 2. Disabled — "Enable" button only
 * 3. Enabled — wallet input, bank input, save button, loans table
 */
export function FinancesSection() {
  const [enabled, setEnabled] = useState(false)
  const [wallet, setWallet] = useState(0)
  const [bank, setBank] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [message, setMessage] = useState("")

  // Fetch once on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetchWithTimeout("/api/finances")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setEnabled(data.finances_enabled)
        setWallet(data.wallet_balance ?? 0)
        setBank(data.bank_balance ?? 0)
      } catch {
        // defaults are fine
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleToggle() {
    setToggling(true)
    setMessage("")
    const newVal = !enabled
    try {
      const res = await fetchWithTimeout("/api/finances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finances_enabled: newVal }),
      })
      if (res.ok) {
        setEnabled(newVal)
        if (!newVal) setMessage("Finances hidden from dashboard")
      }
    } catch {
      // ignore
    } finally {
      setToggling(false)
    }
  }

  async function saveBalances() {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetchWithTimeout("/api/finances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_balance: wallet, bank_balance: bank }),
      })
      if (res.ok) {
        setMessage("Saved")
      } else {
        const d = await res.json().catch(() => ({}))
        setMessage(d.error || "Save failed")
      }
    } catch {
      setMessage("Network error")
    } finally {
      setSaving(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  // ── Disabled — simple enable button ─────────────────────────────────────────
  if (!enabled) {
    return (
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Wallet, Bank & Loans</p>
            <p className="text-xs text-muted-foreground">Track cash on hand, bank balances, and money lent out</p>
          </div>
          <Button onClick={handleToggle} disabled={toggling} variant="outline" size="sm">
            {toggling ? "…" : "Enable"}
          </Button>
        </div>
      </div>
    )
  }

  // ── Enabled — full form + loans ──────────────────────────────────────────────
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Wallet, Bank & Loans</p>
          <p className="text-xs text-muted-foreground">Shown on dashboard</p>
        </div>
        <Button onClick={handleToggle} disabled={toggling} variant="outline" size="sm">
          {toggling ? "…" : "Disable"}
        </Button>
      </div>

      {/* Wallet */}
      <div>
        <label htmlFor="wallet-balance" className="text-sm font-medium">
          Wallet Balance (PKR)
        </label>
        <input
          id="wallet-balance"
          type="number"
          value={wallet || ""}
          onChange={(e) => setWallet(Number(e.target.value) || 0)}
          min={0}
          step={1}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Bank */}
      <div>
        <label htmlFor="bank-balance" className="text-sm font-medium">
          Bank Balance (PKR)
        </label>
        <input
          id="bank-balance"
          type="number"
          value={bank || ""}
          onChange={(e) => setBank(Number(e.target.value) || 0)}
          min={0}
          step={1}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={saveBalances} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save Balances"}
        </Button>
        {message && (
          <span className={`text-sm ${message === "Saved" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
            {message}
          </span>
        )}
      </div>

      {/* Loans */}
      <div className="border-t pt-4">
        <LoansTable />
      </div>
    </div>
  )
}
