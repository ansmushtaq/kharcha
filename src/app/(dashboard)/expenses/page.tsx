"use client"

import { useState, useEffect, useCallback } from "react"
import { ExpenseForm } from "@/components/expenses/ExpenseForm"
import { BillPaymentForm } from "@/components/expenses/BillPaymentForm"
import { ExpenseList } from "@/components/expenses/ExpenseList"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"
import { formatPKR } from "@/lib/utils"

interface FixedCategory {
  id: string
  name: string
  fixed_amount: number
  paid_this_month: number
  outstanding_balance: number
  carries_over: boolean
}

function BillPayView({ onPaid }: { onPaid: () => void }) {
  const [categories, setCategories] = useState<FixedCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState<string | null>(null)

  async function load() {
    try {
      const res = await fetchWithTimeout("/api/summary")
      if (res.ok) {
        const data = await res.json()
        setCategories(data.fixed_categories ?? [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-muted" />
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">No fixed categories yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
        Fixed Categories
      </h3>
      <ul className="divide-y divide-border">
        {categories.map((cat) => {
          const outstanding = cat.outstanding_balance
          const balColor = outstanding <= 0 ? "text-success"
            : outstanding <= cat.fixed_amount * 2 ? "text-warning"
            : "text-destructive"

          return (
            <li key={cat.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{cat.name}</span>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                    <span>Allocation: <span className="tabular-nums">{formatPKR(cat.fixed_amount)}</span></span>
                    <span>Paid: <span className="tabular-nums">{formatPKR(cat.paid_this_month)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold tabular-nums ${balColor}`}>
                    {formatPKR(outstanding)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPayingId(payingId === cat.id ? null : cat.id)}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground min-h-[44px]"
                  >
                    {payingId === cat.id ? "Cancel" : "Pay"}
                  </button>
                </div>
              </div>

              {payingId === cat.id && (
                <BillPaymentForm
                  categoryId={cat.id}
                  categoryName={cat.name}
                  onSaved={() => {
                    setPayingId(null)
                    load()
                    onPaid()
                  }}
                  onCancel={() => setPayingId(null)}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function ExpensesPage() {
  const [tab, setTab] = useState<"expense" | "bill">("expense")
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Expenses</h1>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setTab("expense")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "expense"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Log Expense
        </button>
        <button
          type="button"
          onClick={() => setTab("bill")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === "bill"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pay a Bill
        </button>
      </div>

      {tab === "expense" ? (
        <ExpenseForm onSaved={handleSaved} />
      ) : (
        <BillPayView onPaid={handleSaved} />
      )}

      <ExpenseList refreshKey={refreshKey} />
    </div>
  )
}
