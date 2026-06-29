"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"

interface VariableCategory {
  id: string
  name: string
}

interface Props {
  onSaved: () => void
}

/**
 * Fast inline expense entry on the dashboard.
 *
 * - Amount input (PKR whole integer)
 * - Category dropdown (variable categories only — fixed categories are not
 *   used for daily expense logging)
 * - Optional note
 * - Date is auto-set to today (hidden — this is a quick-add, not a full form)
 *
 * On successful save, calls onSaved() so the parent can refresh summary data.
 */
export function QuickAddForm({ onSaved }: Props) {
  const [categories, setCategories] = useState<VariableCategory[]>([])
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  // Fetch variable categories on mount (uses default month = current month)
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetchWithTimeout("/api/categories")
        if (!res.ok) {
          if (!cancelled) setError("Failed to load categories")
          return
        }
        const data = await res.json()
        // Filter to variable categories only — fixed categories are for budget
        const variableCats = data.filter(
          (c: { type: string }) => c.type === "variable",
        )
        if (cancelled) return
        setCategories(variableCats)
        if (variableCats.length > 0) {
          setCategoryId(variableCats[0].id)
        }
      } catch {
        if (!cancelled) setError("Network error — could not load categories")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Client-side validation matching the API
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      setError("Amount must be a positive whole number")
      return
    }

    if (!categoryId) {
      setError("Please select a category")
      return
    }

    setSaving(true)
    // Date defaults to today — hidden from the form
    const today = new Date().toISOString().slice(0, 10)

    try {
      const res = await fetchWithTimeout("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          category_id: categoryId,
          note: note.trim() || undefined,
          date: today,
        }),
      })

      if (res.ok) {
        // Reset form
        setAmount(0)
        setNote("")
        onSaved()
      } else {
        const d = await res.json()
        setError(d.error || "Failed to add expense")
      }
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Quick Add
      </h3>

      {/* Amount + Category row */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Amount */}
        <div className="min-w-0 flex-1">
          <label htmlFor="qa-amount" className="sr-only">
            Amount (PKR)
          </label>
          <input
            id="qa-amount"
            type="number"
            value={amount || ""}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            min={1}
            step={1}
            required
            placeholder="Amount"
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Category */}
        <div className="min-w-0 flex-[2]">
          <label htmlFor="qa-category" className="sr-only">
            Category
          </label>
          {loading ? (
            <div className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : categories.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No variable categories found.{" "}
              <a href="/settings" className="text-primary underline underline-offset-2 hover:text-primary/80">
                Add one in Settings
              </a>{" "}
              to start tracking expenses.
            </div>
          ) : (
            <select
              id="qa-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Note */}
      <div className="mt-2">
        <label htmlFor="qa-note" className="sr-only">
          Note (optional)
        </label>
        <input
          id="qa-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Note (optional)"
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        className="mt-2 w-full"
        disabled={saving || loading || categories.length === 0}
      >
        {saving ? "Adding…" : "Add Expense"}
      </Button>
    </form>
  )
}
