"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { formatPKR } from "@/lib/utils"
import { todayString } from "@/lib/validation"

interface FixedCategory {
  id: string
  name: string
  fixed_amount: number
  outstanding_balance: number
}

interface Props {
  onSaved: () => void
}

/**
 * Pay a Bill form for the /expenses page.
 *
 * Fetches fixed categories with outstanding balances from /api/summary,
 * shows a dropdown with current outstanding next to each option,
 * and logs a payment (full or partial) as a regular expense.
 *
 * Amount label says "Amount you're paying now" — the user enters the
 * payment they're making, not the target outstanding total.
 */
export function BillPaymentTabForm({ onSaved }: Props) {
  const [categories, setCategories] = useState<FixedCategory[]>([])
  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState("")
  const [date, setDate] = useState(todayString())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetchWithTimeout("/api/summary")
        if (!res.ok) {
          if (!cancelled) setError("Failed to load categories")
          return
        }
        const data = await res.json()
        // Keep only fixed categories as defined in the API response
        const fixed: FixedCategory[] = (data.fixed_categories ?? []).map(
          (c: { id: string; name: string; fixed_amount: number; outstanding_balance: number }) => ({
            id: c.id,
            name: c.name,
            fixed_amount: c.fixed_amount,
            outstanding_balance: c.outstanding_balance,
          }),
        )
        if (cancelled) return
        setCategories(fixed)
        if (fixed.length > 0) {
          setCategoryId(fixed[0].id)
        }
      } catch {
        if (!cancelled) setError("Network error — could not load categories")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      setError("Amount must be a positive whole number")
      return
    }

    if (!categoryId) {
      setError("Please select a category")
      return
    }

    if (!date) {
      setError("Date is required")
      return
    }

    setSaving(true)
    try {
      const res = await fetchWithTimeout("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          category_id: categoryId,
          date,
          note: note.trim() || undefined,
        }),
      })

      if (res.ok) {
        setAmount(0)
        setNote("")
        onSaved()
      } else {
        const d = await res.json()
        setError(d.error || "Failed to log payment")
      }
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  const selected = categories.find((c) => c.id === categoryId)

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">Pay a Bill</h2>

      {/* Category dropdown — fixed categories with outstanding balance */}
      <div>
        <label className="text-sm font-medium" htmlFor="bp-category">
          Fixed Category
        </label>
        {loading ? (
          <p className="mt-1 text-sm text-muted-foreground">Loading categories…</p>
        ) : categories.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No fixed categories — create one in Settings
          </p>
        ) : (
          <select
            id="bp-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} (outstanding: {formatPKR(cat.outstanding_balance)})
              </option>
            ))}
          </select>
        )}
        {selected && (
          <p className="mt-1 text-xs text-muted-foreground">
            Monthly allocation: {formatPKR(selected.fixed_amount)} · Outstanding: {formatPKR(selected.outstanding_balance)}
          </p>
        )}
      </div>

      {/* Amount — labeled "Amount you're paying now" per Section 6.3 */}
      <div>
        <label className="text-sm font-medium" htmlFor="bp-amount">
          Amount you&apos;re paying now
        </label>
        <input
          id="bp-amount"
          type="number"
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          min={1}
          step={1}
          required
          placeholder="e.g. 5000"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Note */}
      <div>
        <label className="text-sm font-medium" htmlFor="bp-note">
          Note (optional)
        </label>
        <input
          id="bp-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="e.g. partial rent payment"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Date */}
      <div>
        <label className="text-sm font-medium" htmlFor="bp-date">
          Date
        </label>
        <input
          id="bp-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={saving || loading || categories.length === 0}>
        {saving ? "Saving…" : "Log Payment"}
      </Button>
    </form>
  )
}
