"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { LoanForm } from "./LoanForm"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { Pencil, Trash2 } from "lucide-react"

interface Loan {
  id: string
  borrower_name: string
  amount: number
  date_lent: string
  is_repaid: boolean
  repaid_at: string | null
  note: string | null
  created_at: string
}

/**
 * List of loans given with action controls.
 *
 * Each row shows: borrower name, amount (PKR), date lent, repaid/outstanding badge,
 * mark-repaid button, edit button, and delete button with confirm dialog.
 *
 * Handles loading, empty, and error states.
 */
export function LoansTable() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Loan | null>(null)

  const fetchLoans = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetchWithTimeout("/api/loans?status=all")
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || "Failed to load loans")
        return
      }
      const data: Loan[] = await res.json()
      setLoans(data)
    } catch {
      setError("Network error — could not load loans")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  /** Mark a loan as repaid. */
  async function markRepaid(loan: Loan) {
    try {
      const res = await fetchWithTimeout(`/api/loans/${loan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_repaid: true }),
      })

      if (res.ok) {
        fetchLoans()
      }
    } catch {
      // Silent — the user can retry
    }
  }

  /** Delete a loan with confirmation. */
  async function deleteLoan(loan: Loan) {
    if (
      !confirm(
        `Delete loan from "${loan.borrower_name}" (PKR ${loan.amount.toLocaleString("en-PK")})? This cannot be undone.`,
      )
    ) {
      return
    }

    try {
      const res = await fetchWithTimeout(`/api/loans/${loan.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchLoans()
      }
    } catch {
      // Silent
    }
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Loans Given</h3>
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border bg-muted"
          />
        ))}
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Loans Given</h3>
          <Button size="sm" variant="outline" onClick={fetchLoans}>
            Retry
          </Button>
        </div>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  // ── Empty state ──
  if (loans.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Loans Given</h3>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Add Loan
          </Button>
        </div>

        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No loans yet. Click &ldquo;Add Loan&rdquo; to record money you&apos;ve lent to someone.
          </p>
        </div>

        <LoanForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={fetchLoans}
          edit={editing}
        />
      </div>
    )
  }

  // ── Data state ──
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Loans Given ({loans.length})
        </h3>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          Add Loan
        </Button>
      </div>

      <div className="space-y-2">
        {loans.map((loan) => (
          <div
            key={loan.id}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            {/* Loan info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {loan.borrower_name}
                </span>
                {/* Repaid / Outstanding badge */}
                <span
                  className={`text-xs px-1.5 py-0.5 shrink-0 rounded ${
                    loan.is_repaid
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  }`}
                >
                  {loan.is_repaid ? "Repaid" : "Outstanding"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                PKR {loan.amount.toLocaleString("en-PK")}
                {" · "}
                {loan.date_lent}
                {loan.note && ` · ${loan.note}`}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Mark repaid — only when outstanding */}
              {!loan.is_repaid && (
                <button
                  type="button"
                  onClick={() => markRepaid(loan)}
                  title="Mark as repaid"
                  className="inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded border border-green-300 text-green-700 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950 min-h-[44px] min-w-[44px]"
                >
                  Repaid
                </button>
              )}

              {/* Edit */}
              <button
                type="button"
                onClick={() => {
                  setEditing(loan)
                  setFormOpen(true)
                }}
                className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px]"
                title="Edit loan"
              >
                <Pencil className="size-4" />
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => deleteLoan(loan)}
                className="inline-flex items-center justify-center text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px]"
                title="Delete loan"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <LoanForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchLoans}
        edit={editing}
      />
    </div>
  )
}
