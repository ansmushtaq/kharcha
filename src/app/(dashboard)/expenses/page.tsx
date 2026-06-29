"use client"

import { useState, useCallback } from "react"
import { ExpenseForm } from "@/components/expenses/ExpenseForm"
import { ExpenseList } from "@/components/expenses/ExpenseList"

export default function ExpensesPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Expenses</h1>

      <ExpenseForm onSaved={handleSaved} />
      <ExpenseList refreshKey={refreshKey} />
    </div>
  )
}
