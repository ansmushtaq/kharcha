export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function isValidMonth(m: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m)
}

export function isValidDateFormat(d: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)
}

export function isValidCalendarDate(d: string): boolean {
  if (!isValidDateFormat(d)) return false
  // Parse as UTC midnight so the toISOString round-trip is timezone-agnostic
  const parsed = new Date(d + "T00:00:00Z")
  if (isNaN(parsed.getTime())) return false
  return parsed.toISOString().slice(0, 10) === d
}

export function isValidUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number)
  return new Date(y, m, 0).getDate()
}
