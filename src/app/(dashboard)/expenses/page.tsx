"use client"

import { useState, useCallback } from "react"
import { ExpenseForm } from "@/components/expenses/ExpenseForm"
import { BillPaymentTabForm } from "@/components/expenses/BillPaymentTabForm"
import { ExpenseList } from "@/components/expenses/ExpenseList"

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
        <BillPaymentTabForm onSaved={handleSaved} />
      )}

      <ExpenseList refreshKey={refreshKey} />
    </div>
  )
}
