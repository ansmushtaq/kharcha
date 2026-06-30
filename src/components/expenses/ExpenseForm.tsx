"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { todayString } from "@/lib/validation"

interface VariableCategory {
  id: string
  name: string
  color: string | null
}

interface Props {
  onSaved: () => void
}

export function ExpenseForm({ onSaved }: Props) {
  const [categories, setCategories] = useState<VariableCategory[]>([])
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState("")
  const [note, setNote] = useState("")
  const [date, setDate] = useState(todayString())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  // Fetch variable categories on mount
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
        // Filter to variable categories only — fixed categories are for budget, not daily spend
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
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    const amountVal = amount
    if (!amountVal || amountVal <= 0 || !Number.isInteger(amountVal)) {
      setError("Amount must be a positive whole number")
      return
    }

    if (!date) {
      setError("Date is required")
      return
    }

    setSaving(true)
    const body: Record<string, unknown> = {
      amount: amountVal,
      date,
    }
    if (categoryId) body.category_id = categoryId
    if (note.trim()) body.note = note.trim()

    try {
      const res = await fetchWithTimeout("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setAmount(0)
        setNote("")
        setCategoryId(categories.length > 0 ? categories[0].id : "")
        setDate(todayString())
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
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">Add Expense</h2>

      {/* Amount */}
      <div>
        <label className="text-sm font-medium" htmlFor="exp-amount">
          Amount (PKR)
        </label>
        <input
          id="exp-amount"
          type="number"
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          min={1}
          step={1}
          required
          placeholder="e.g. 450"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Category dropdown — variable categories only */}
      <div>
        <label className="text-sm font-medium" htmlFor="exp-category">
          Category
        </label>
        {loading ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Loading categories…
          </p>
        ) : (
          <select
            id="exp-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {categories.length === 0 ? (
              <option value="">
                No variable categories — create one in Settings
              </option>
            ) : (
              categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))
            )}
          </select>
        )}
      </div>

      {/* Note */}
      <div>
        <label className="text-sm font-medium" htmlFor="exp-note">
          Note (optional)
        </label>
        <input
          id="exp-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="e.g. lunch at Haveli"
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Date */}
      <div>
        <label className="text-sm font-medium" htmlFor="exp-date">
          Date
        </label>
        <input
          id="exp-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={saving || loading}>
        {saving ? "Adding…" : "Add Expense"}
      </Button>
    </form>
  )
}
