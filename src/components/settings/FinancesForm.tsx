"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"

/**
 * Wallet balance + bank balance number inputs with a single Save button.
 *
 * Fetches current values from GET /api/finances on mount.
 * Sends PATCH /api/finances on save with the current wallet and bank balances.
 * Handles loading, saving, and error states.
 */
export function FinancesForm() {
  const [walletBalance, setWalletBalance] = useState(0)
  const [bankBalance, setBankBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Fetch current values on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetchWithTimeout("/api/finances")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setWalletBalance(data.wallet_balance ?? 0)
        setBankBalance(data.bank_balance ?? 0)
      } catch {
        // Use defaults (0/0) on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    setError("")
    setSuccess("")

    // Client-side validation
    if (
      typeof walletBalance !== "number" ||
      !Number.isFinite(walletBalance) ||
      !Number.isInteger(walletBalance) ||
      walletBalance < 0
    ) {
      setError("Wallet balance must be a non-negative whole number")
      return
    }

    if (
      typeof bankBalance !== "number" ||
      !Number.isFinite(bankBalance) ||
      !Number.isInteger(bankBalance) ||
      bankBalance < 0
    ) {
      setError("Bank balance must be a non-negative whole number")
      return
    }

    setSaving(true)

    try {
      const res = await fetchWithTimeout("/api/finances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_balance: walletBalance,
          bank_balance:   bankBalance,
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || "Failed to save balances")
        return
      }

      setSuccess("Balances saved")
    } catch {
      setError("Network error — could not save balances")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="h-10 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Wallet & Bank Balances
      </h3>

      {/* Wallet balance */}
      <div>
        <label
          htmlFor="wallet-balance"
          className="text-sm font-medium"
        >
          Wallet Balance (PKR)
        </label>
        <input
          id="wallet-balance"
          type="number"
          value={walletBalance}
          onChange={(e) => setWalletBalance(Number(e.target.value) || 0)}
          min={0}
          step={1}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Bank balance */}
      <div>
        <label
          htmlFor="bank-balance"
          className="text-sm font-medium"
        >
          Bank Balance (PKR)
        </label>
        <input
          id="bank-balance"
          type="number"
          value={bankBalance}
          onChange={(e) => setBankBalance(Number(e.target.value) || 0)}
          min={0}
          step={1}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save Balances"}
      </Button>
    </div>
  )
}
