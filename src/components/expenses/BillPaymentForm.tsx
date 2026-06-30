"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { todayString } from "@/lib/validation"

interface Props {
  categoryId: string
  categoryName: string
  onSaved: () => void
  onCancel: () => void
}

/**
 * Log a payment (full or partial) against a fixed category.
 * Saves as a regular expense with category_id = the fixed category.
 */
export function BillPaymentForm({
  categoryId,
  categoryName,
  onSaved,
  onCancel,
}: Props) {
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState("")
  const [date, setDate] = useState(todayString())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      setError("Amount must be a positive whole number")
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

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Pay: {categoryName}</h4>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Amount */}
      <div>
        <label className="text-sm font-medium" htmlFor="bp-amount">
          Amount (PKR)
        </label>
        <input
          id="bp-amount"
          type="number"
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          min={1}
          step={1}
          required
          placeholder="e.g. 2000"
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
          placeholder="e.g. partial payment"
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

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Log Payment"}
      </Button>
    </form>
  )
}
