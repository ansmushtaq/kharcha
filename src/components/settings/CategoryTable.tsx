"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { CategoryForm } from "./CategoryForm"
import { Pencil, Trash2 } from "lucide-react"

interface Category {
  id: string
  name: string
  type: "fixed" | "variable"
  fixedAmount: number | null
  carriesOver: boolean
  isActive: boolean
  color: string | null
  createdForMonth: string
  sortOrder: number
}

export function CategoryTable() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/categories?all=true")
    const data = await res.json()
    setCategories(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  async function toggleField(cat: Category, field: "carriesOver" | "isActive") {
    await fetch(`/api/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(field === "carriesOver" ? { carries_over: !cat.carriesOver } : { is_active: !cat.isActive }),
    })
    fetchCategories()
  }

  async function deleteCategory(cat: Category) {
    if (!confirm(`Delete "${cat.name}"? Expenses linked to it will show as "Uncategorized".`)) return
    await fetch(`/api/categories/${cat.id}`, { method: "DELETE" })
    fetchCategories()
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading categories…</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Categories</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No categories yet. Add one to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              {/* Color dot */}
              {cat.color && (
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{cat.name}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      cat.type === "fixed"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    }`}
                  >
                    {cat.type}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {cat.type === "fixed" && cat.fixedAmount != null
                    ? `PKR ${cat.fixedAmount.toLocaleString()}`
                    : "No preset amount"}
                  {" · "}
                  {cat.carriesOver ? "Carries over" : "One-time"}
                  {!cat.isActive && " · Inactive"}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleField(cat, "isActive")}
                  title={cat.isActive ? "Active" : "Inactive"}
                  className={`inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded border hover:bg-muted min-h-[44px] min-w-[44px] ${
                    cat.isActive
                      ? "border-green-300 text-green-700 dark:text-green-400 dark:border-green-700"
                      : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {cat.isActive ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleField(cat, "carriesOver")}
                  title={cat.carriesOver ? "Carries over" : "One-time"}
                  className={`inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded border text-muted-foreground hover:bg-muted min-h-[44px] min-w-[44px] ${
                    cat.carriesOver ? "border-green-300 dark:border-green-700" : "border-orange-300 dark:border-orange-700"
                  }`}
                >
                  {cat.carriesOver ? "↻" : "1×"}
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditing(cat)
                    setFormOpen(true)
                  }}
                  className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px]"
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  onClick={() => deleteCategory(cat)}
                  className="inline-flex items-center justify-center text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px]"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={fetchCategories}
        edit={editing}
      />
    </div>
  )
}
