import { CategoryTable } from "@/components/settings/CategoryTable"
import { SalaryDailyLimitInput } from "@/components/settings/SalaryDailyLimitInput"
import { FinancesSection } from "@/components/settings/FinancesSection"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <SalaryDailyLimitInput />
      <CategoryTable />
      <FinancesSection />
    </div>
  )
}
