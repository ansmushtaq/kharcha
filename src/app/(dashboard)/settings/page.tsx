"use client"

import { useState, useEffect, useCallback } from "react"
import { CategoryTable } from "@/components/settings/CategoryTable"
import { DailyLimitInput } from "@/components/settings/DailyLimitInput"
import { FinancesToggle } from "@/components/settings/FinancesToggle"
import { FinancesForm } from "@/components/settings/FinancesForm"
import { LoansTable } from "@/components/settings/LoansTable"
import { fetchWithTimeout } from "@/lib/fetchWithTimeout"

export default function SettingsPage() {
  const [financesEnabled, setFinancesEnabled] = useState<boolean | null>(null)
  const [initialCheckDone, setInitialCheckDone] = useState(false)

  const checkFinancesEnabled = useCallback(async () => {
    if (initialCheckDone) return
    try {
      const res = await fetchWithTimeout("/api/finances")
      if (res.ok) {
        const data = await res.json()
        setFinancesEnabled(data.finances_enabled)
      } else {
        setFinancesEnabled(false)
      }
    } catch {
      setFinancesEnabled(false)
    } finally {
      setInitialCheckDone(true)
    }
  }, [initialCheckDone])

  useEffect(() => {
    checkFinancesEnabled()
  }, [checkFinancesEnabled])

  function handleToggle(newValue: boolean) {
    setFinancesEnabled(newValue)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <DailyLimitInput />
      <CategoryTable />

      {/* ── Finances Section ── */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Finances</h2>

        <FinancesToggle onToggle={handleToggle} />

        {/* Only show the rest when finances are enabled */}
        {financesEnabled === true && (
          <>
            <FinancesForm />
            <LoansTable />
          </>
        )}
      </div>
    </div>
  )
}
