import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** PKR whole-number formatting. */
export function formatPKR(n: number): string {
  return `PKR ${n.toLocaleString("en-PK")}`
}

export const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function safeHex(c: string | null): string | null {
  return c && HEX_RE.test(c) ? c : null
}
