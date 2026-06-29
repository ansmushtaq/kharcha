"use client"

import { useState, useEffect } from "react"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"

interface Props {
  /** Called after the toggle state changes successfully so the parent can re-fetch. */
  onToggle: (newValue: boolean) => void
}

/**
 * Enable/disable toggle for the whole Finances feature.
 *
 * Calls PATCH /api/finances with { finances_enabled: true/false }.
 * Shows a loading spinner while saving, and an error message if the
 * request fails. When disabled, the parent hides FinancesForm + LoansTable.
 */
export function FinancesToggle({ onToggle }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Fetch current state on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetchWithTimeout("/api/finances")
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setEnabled(data.finances_enabled)
      } catch {
        // Silently fail — the toggle defaults to off
      } finally {
        if (!cancelled) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  async function handleToggle() {
    if (saving) return

    const newValue = !enabled
    setEnabled(newValue) // optimistic
    setSaving(true)

    try {
      const res = await fetchWithTimeout("/api/finances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finances_enabled: newValue }),
      })

      if (!res.ok) {
        // Revert on failure
        setEnabled(!newValue)
        return
      }

      onToggle(newValue)
    } catch {
      // Network error — revert
      setEnabled(!newValue)
    } finally {
      setSaving(false)
    }
  }

  if (!initialized && loading) {
    return (
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Track wallet, bank & loans</p>
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
        <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Track wallet, bank & loans</p>
        <p className="text-xs text-muted-foreground">
          {enabled
            ? "Enabled — wallet and bank balances are shown on the dashboard"
            : "Disabled — finances section and dashboard card are hidden"}
        </p>
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        aria-label={enabled ? "Disable finances tracking" : "Enable finances tracking"}
        className={`relative flex items-center justify-center h-6 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-muted-foreground/30"
        } ${saving ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  )
}
