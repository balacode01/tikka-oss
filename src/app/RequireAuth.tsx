import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSession } from './session-context'

// Sends signed-out visitors to log in, and remembers where they were going.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-text-secondary">Loading</div>
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
