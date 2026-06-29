"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

export function DailyLimitInput() {
  const [limit, setLimit] = useState(1200)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/budget-config")
      .then((r) => r.json())
      .then((d) => setLimit(d.daily_limit))
      .catch(() => {})
  }, [])

  async function save() {
    setSaving(true)
    setMessage("")
    const res = await fetch("/api/budget-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_limit: limit }),
    })
    if (res.ok) {
      setMessage("Saved")
    } else {
      setMessage("Error saving")
    }
    setSaving(false)
  }

  const days30 = 30 * limit
  const days31 = 31 * limit

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="font-semibold">Daily Budget Limit</h2>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">PKR</span>
        <input
          type="number"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value) || 0)}
          min={0}
          className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-sm text-muted-foreground">/ day</span>
        <Button onClick={save} disabled={saving} size="sm" className="min-h-[44px]">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        30-day month adds PKR {days30.toLocaleString()} · 31-day: PKR {days31.toLocaleString()}
      </p>

      {message && (
        <p className={`text-sm ${message === "Saved" ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
          {message}
        </p>
      )}
    </div>
  )
}
