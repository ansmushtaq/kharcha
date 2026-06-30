// ─── Daily Budget Countdown ──────────────────────────────────────────────────

/** Days remaining in month from a given date (inclusive — counts today). */
export function daysRemaining(month: string, today: Date): number {
  const [y, m] = month.split("-").map(Number)
  const total = new Date(y, m, 0).getDate()
  return total - today.getDate() + 1
}

/** Effective daily rate going forward. Returns 0 if no days remain. */
export function effectiveDailyRate(
  remainingPool: number,
  daysRem: number,
): number {
  if (daysRem <= 0) return remainingPool
  return Math.round(remainingPool / daysRem)
}

// ─── Rolling Fixed Cost Balance ───────────────────────────────────────────────

/**
 * Rolling outstanding balance for a fixed category up to a given month.
 *
 * For each month X from created_for_month through upToMonth where the category
 * is visible, we accrue allocation(C, X) and subtract paid_in_month(C, X).
 */
export function outstandingBalance(
  fixedAmount: number,
  createdForMonth: string,
  paymentsPerMonth: Record<string, number>, // { 'YYYY-MM': amountPaid }
  upToMonth: string,
): number {
  const [startY, startM] = createdForMonth.split("-").map(Number)
  const [endY, endM] = upToMonth.split("-").map(Number)

  let balance = 0
  let y = startY
  let m = startM

  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, "0")}`
    const paid = paymentsPerMonth[key] ?? 0
    balance += fixedAmount - paid
    // Next month
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  return balance
}
