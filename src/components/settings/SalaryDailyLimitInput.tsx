"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

export function SalaryDailyLimitInput() {
  const [salary, setSalary] = useState(0)
  const [limit, setLimit] = useState(1200)
  const [additionalIncome, setAdditionalIncome] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/budget-config")
      .then((r) => r.json())
      .then((d) => {
        setSalary(d.salary ?? 0)
        setLimit(d.daily_limit ?? 1200)
        setAdditionalIncome(d.additional_income ?? 0)
      })
      .catch(() => {})
  }, [])

  async function save() {
    setSaving(true)
    setMessage("")
    const res = await fetch("/api/budget-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salary, daily_limit: limit, additional_income: additionalIncome }),
    })
    if (res.ok) {
      setMessage("Saved")
    } else {
      const d = await res.json().catch(() => ({}))
      setMessage(d.error || "Error saving")
    }
    setSaving(false)
  }

  const days30 = 30 * limit
  const days31 = 31 * limit

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h2 className="font-semibold">Salary &amp; Daily Budget</h2>

      {/* Salary */}
      <div className="flex items-center gap-3">
        <span className="min-w-[60px] text-sm text-muted-foreground">Salary PKR</span>
        <input
          type="number"
          value={salary || ""}
          onChange={(e) => setSalary(Number(e.target.value) || 0)}
          min={0}
          step={1}
          className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Daily Limit */}
      <div className="flex items-center gap-3">
        <span className="min-w-[60px] text-sm text-muted-foreground">Daily PKR</span>
        <input
          type="number"
          value={limit || ""}
          onChange={(e) => setLimit(Number(e.target.value) || 0)}
          min={0}
          step={1}
          className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-sm text-muted-foreground">/ day</span>
        <Button onClick={save} disabled={saving} size="sm" className="min-h-[44px]">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* Additional Income */}
      <div className="flex items-center gap-3">
        <span className="min-w-[60px] text-sm text-muted-foreground">Extra PKR</span>
        <input
          type="number"
          value={additionalIncome || ""}
          onChange={(e) => setAdditionalIncome(Number(e.target.value) || 0)}
          min={0}
          step={1}
          className="w-32 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-sm text-muted-foreground">carryover / extra this month</span>
      </div>

      <p className="text-xs text-muted-foreground">
        30-day month: PKR {days30.toLocaleString()} · 31-day: PKR {days31.toLocaleString()}
      </p>

      {message && (
        <p className={`text-sm ${message === "Saved" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
          {message}
        </p>
      )}
    </div>
  )
}
