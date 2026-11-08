export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tikka-theme'

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Storage can be blocked (private window, cleared site data). Fall back to system.
  }
  return 'system'
}

export function saveThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Ignore: the choice still applies for this page view.
  }
}

// Sets data-theme on <html>. "system" follows the OS through matchMedia.
export function applyTheme(preference: ThemePreference) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference
  document.documentElement.setAttribute('data-theme', resolved)
}
