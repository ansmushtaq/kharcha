/**
 * Production fetch wrapper with timeout and global 401 handling.
 *
 * If any API call returns a 401 status (session expired, token invalid),
 * this redirects the user to /login so they can re-authenticate rather
 * than seeing broken UI or silent failures.
 *
 * Usage: import { api } from "@/lib/api" instead of raw fetch().
 */
import { fetchWithTimeout } from "./fetchWithTimeout"

export async function api(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const res = await fetchWithTimeout(url, options, timeoutMs)

  // Global 401 => session expired; redirect to login
  if (res.status === 401) {
    // Only redirect if not already on the login page to avoid loops
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login"
    }
    // Throw so callers don't try to parse a redirected response body
    throw new Error("Unauthorized — redirecting to login")
  }

  return res
}
