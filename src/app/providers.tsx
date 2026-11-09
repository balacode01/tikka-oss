import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { SessionProvider } from './session'
import { applyTheme, readThemePreference, type ThemePreference } from './theme'

// Keeps the theme in sync with the stored choice, and with the OS while set to "system".
function ThemeSync({ children }: { children: ReactNode }) {
  const [preference] = useState<ThemePreference>(() => readThemePreference())

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  return children
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }))

  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <ThemeSync>
          {children}
          <Toaster position="bottom-right" />
        </ThemeSync>
      </SessionProvider>
    </QueryClientProvider>
  )
}
