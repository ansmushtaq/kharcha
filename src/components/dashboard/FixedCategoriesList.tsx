"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BillPaymentForm } from "@/components/expenses/BillPaymentForm"
import { formatPKR } from "@/lib/utils"

interface FixedCategory {
  id: string
  name: string
  fixed_amount: number
  paid_this_month: number
  outstanding_balance: number
  carries_over: boolean
}

interface Props {
  categories: FixedCategory[]
  onPaid: () => void
}

/**
 * Lists the user's active fixed categories with allocation, paid-this-month,
 * and rolling outstanding balance.
 *
 * Colour coding:
 * - text-success if outstanding = 0
 * - text-warning if partially paid (outstanding > 0 but ≤ 2x allocation)
 * - text-destructive if outstanding > 2x monthly allocation
 */
export function FixedCategoriesList({ categories, onPaid }: Props) {
  const [payingCategory, setPayingCategory] = useState<{
    id: string
    name: string
  } | null>(null)

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Fixed Categories
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No fixed categories set up yet. Add them in Settings.
        </p>
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
          const allocation = cat.fixed_amount
          const outstanding = cat.outstanding_balance

          let balanceColor: string
          if (outstanding <= 0) {
            balanceColor = "text-success"
          } else if (outstanding <= allocation * 2) {
            balanceColor = "text-warning"
          } else {
            balanceColor = "text-destructive"
          }

          return (
            <li
              key={cat.id}
              className="py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{cat.name}</span>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                    <span>Allocation: <span className="tabular-nums">{formatPKR(allocation)}</span></span>
                    <span>Paid: <span className="tabular-nums">{formatPKR(cat.paid_this_month)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold tabular-nums ${balanceColor}`}>
                    {formatPKR(outstanding)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPayingCategory({ id: cat.id, name: cat.name })
                    }
                  >
                    Pay
                  </Button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Show the category name as subtitle */}
      {payingCategory && (
        <div className="mt-1 text-xs text-muted-foreground">
          Outstanding balance shown{payingCategory.name ? ` for ${payingCategory.name}` : ""}
        </div>
      )}

      {payingCategory && (
        <BillPaymentForm
          categoryId={payingCategory.id}
          categoryName={payingCategory.name}
          onSaved={() => {
            setPayingCategory(null)
            onPaid()
          }}
          onCancel={() => setPayingCategory(null)}
        />
      )}
    </div>
  )
}
