import { auth } from "@/lib/auth"

export async function TopBar() {
  const session = await auth()
  const name = session?.user?.name ?? "User"

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-12 max-w-lg items-center justify-between px-4">
        <span className="text-lg font-bold">kharcha</span>
        <span className="text-sm text-muted-foreground">{name}</span>
      </div>
    </header>
  )
}
