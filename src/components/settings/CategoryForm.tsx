"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface Category {
  id: string
  name: string
  type: "fixed" | "variable"
  fixedAmount: number | null
  carriesOver: boolean
  color: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  edit?: Category | null
}

export function CategoryForm({ open, onClose, onSaved, edit }: Props) {
  const [name, setName] = useState("")
  const [type, setType] = useState<"fixed" | "variable">("variable")
  const [amount, setAmount] = useState(0)
  const [carriesOver, setCarriesOver] = useState(true)
  const [color, setColor] = useState("#3498db")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (edit) {
      setName(edit.name)
      setType(edit.type)
      setAmount(edit.fixedAmount ?? 0)
      setCarriesOver(edit.carriesOver)
      setColor(edit.color ?? "#3498db")
    } else {
      setName("")
      setType("variable")
      setAmount(0)
      setCarriesOver(true)
      setColor("#3498db")
    }
    setError("")
  }, [edit, open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("Name is required")
      return
    }

    setSaving(true)
    const body = {
      name: name.trim(),
      type,
      fixed_amount: type === "fixed" ? amount : null,
      carries_over: carriesOver,
      color,
    }

    const url = edit
      ? `/api/categories/${edit.id}`
      : "/api/categories"
    const method = edit ? "PATCH" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      onSaved()
      onClose()
    } else {
      const d = await res.json()
      setError(d.error || "Failed to save")
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">
          {edit ? "Edit Category" : "Add Category"}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Rent"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Type</label>
            <div className="mt-1 flex gap-2">
              {(["fixed", "variable"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t)
                    if (t === "variable") setAmount(0)
                  }}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                    type === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted"
                  }`}
                >
                  {t === "fixed" ? "Fixed" : "Variable"}
                </button>
              ))}
            </div>
          </div>

          {type === "fixed" && (
            <div>
              <label className="text-sm font-medium">Amount (PKR)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                min={0}
                required
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Carries over every month</label>
            <button
              type="button"
              onClick={() => setCarriesOver(!carriesOver)}
              className={`relative h-6 w-11 min-h-[44px] min-w-[44px] rounded-full transition-colors ${
                carriesOver ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${
                  carriesOver ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div>
            <label className="text-sm font-medium">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="mt-1 block h-9 w-full rounded-md border border-input bg-background p-1 outline-none"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Saving…" : edit ? "Update" : "Create"}
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
