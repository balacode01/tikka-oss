// Returns the "next" address from a link only when it is a path inside the app.
export function safeNext(value: string | null, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  return value
}
