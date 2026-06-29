"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"

interface Loan {
  id: string
  borrower_name: string
  amount: number
  date_lent: string
  is_repaid: boolean
  note: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  edit?: Loan | null
}

/**
 * Add / edit loan modal.
 *
 * Fields: borrower_name (text), amount (number), date_lent (date picker,
 * defaults to today), note (optional textarea).
 *
 * POST for add, PATCH for edit. Validates all fields client-side.
 * Handles loading, saving, and error states.
 */
export function LoanForm({ open, onClose, onSaved, edit }: Props) {
  const [borrowerName, setBorrowerName] = useState("")
  const [amount, setAmount] = useState(0)
  const [dateLent, setDateLent] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Reset or pre-fill form on open / edit change
  useEffect(() => {
    if (!open) return

    if (edit) {
      setBorrowerName(edit.borrower_name)
      setAmount(edit.amount)
      setDateLent(edit.date_lent)
      setNote(edit.note ?? "")
    } else {
      setBorrowerName("")
      setAmount(0)
      // Default to today in local timezone
      setDateLent(new Date().toISOString().slice(0, 10))
      setNote("")
    }
    setError("")
  }, [edit, open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    // Client-side validation
    if (!borrowerName.trim()) {
      setError("Borrower name is required")
      return
    }
    if (borrowerName.trim().length > 100) {
      setError("Borrower name must be at most 100 characters")
      return
    }

    if (
      !amount ||
      !Number.isFinite(amount) ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      setError("Amount must be a positive whole number (PKR)")
      return
    }

    if (!dateLent) {
      setError("Date lent is required")
      return
    }

    if (note.length > 500) {
      setError("Note must be at most 500 characters")
      return
    }

    setSaving(true)

    const body: Record<string, unknown> = {
      borrower_name: borrowerName.trim(),
      amount,
      date_lent: dateLent,
      note: note.trim() || null,
    }

    const url = edit
      ? `/api/loans/${edit.id}`
      : "/api/loans"
    const method = edit ? "PATCH" : "POST"

    try {
      const res = await fetchWithTimeout(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        onSaved()
        onClose()
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || "Failed to save loan")
      }
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">
          {edit ? "Edit Loan" : "Add Loan"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Borrower name */}
          <div>
            <label htmlFor="loan-borrower" className="text-sm font-medium">
              Borrower Name
            </label>
            <input
              id="loan-borrower"
              type="text"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              required
              maxLength={100}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Ali"
            />
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="loan-amount" className="text-sm font-medium">
              Amount (PKR)
            </label>
            <input
              id="loan-amount"
              type="number"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              min={1}
              step={1}
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. 3000"
            />
          </div>

          {/* Date lent */}
          <div>
            <label htmlFor="loan-date" className="text-sm font-medium">
              Date Lent
            </label>
            <input
              id="loan-date"
              type="date"
              value={dateLent}
              onChange={(e) => setDateLent(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Note (optional) */}
          <div>
            <label htmlFor="loan-note" className="text-sm font-medium">
              Note <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="loan-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="e.g. for rent"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {note.length}/500
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving…" : edit ? "Update" : "Add Loan"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
