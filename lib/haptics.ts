/**
 * A short buzz when a score is saved or undone, on phones and tablets that can (Android). Laptops,
 * iPads and iPhones have no web vibration: there it does nothing, which is fine.
 */
export function buzz(pattern: number | number[] = 40) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Blocked (no user interaction yet, or a permissions policy): the screen shows the result anyway.
  }
}
