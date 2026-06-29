import { TopBar } from "@/components/layout/TopBar"
import { BottomNav } from "@/components/layout/BottomNav"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-lg px-4 pb-20 pt-4">
        {children}
      </main>
      <BottomNav />
    </>
  )
}
