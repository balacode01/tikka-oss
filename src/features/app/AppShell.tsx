import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../app/session-context'
import { readThemePreference, applyTheme, saveThemePreference, type ThemePreference } from '../../app/theme'
import { useWorkspaceProjects } from './useWorkspaceProjects'

export function AppShell() {
  const { workspace = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()
  const { data } = useWorkspaceProjects(workspace || undefined)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference())

  const name = (session?.user.user_metadata?.display_name as string | undefined) ?? session?.user.email ?? 'You'
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

  function chooseTheme(next: ThemePreference) {
    setTheme(next)
    saveThemePreference(next)
    applyTheme(next)
  }

  async function logOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-surface-page text-text-primary">
      <aside className="flex w-60 shrink-0 flex-col gap-1 border-border border-r p-3" aria-label="Sidebar">
        <Link to="/home" className="px-2 py-2 font-semibold text-base">Tikka</Link>
        <NavLink
          to="/home"
          className={({ isActive }) =>
            `rounded-sm px-2 py-1.5 text-sm ${isActive ? 'bg-surface-selected font-medium text-primary-subtle-text' : 'text-text-primary hover:bg-surface-hover'}`
          }
        >
          Your work
        </NavLink>

        {data?.workspace && (
          <>
            <p className="mt-4 px-2 text-xs font-medium text-text-secondary">{data.workspace.name}</p>
            {data.projects.map((p) => (
              <NavLink
                key={p.id}
                to={`/w/${data.workspace!.slug}/p/${p.key}/board`}
                className={({ isActive }) =>
                  `rounded-sm px-2 py-1.5 text-sm ${isActive ? 'bg-surface-selected font-medium text-primary-subtle-text' : 'text-text-primary hover:bg-surface-hover'}`
                }
              >
                {p.name}
              </NavLink>
            ))}
          </>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-border border-b px-6">
          <Button
            className="w-64 justify-start text-text-secondary"
            onClick={() => toast('Quick search arrives in M6')}
            aria-label="Search (Ctrl or Cmd+K)"
          >
            Search
            <span className="ml-auto font-mono text-xs">Ctrl K</span>
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" onClick={() => toast('Create issue arrives with the Board in M5')}>
              Create issue
            </Button>
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="grid size-8 cursor-pointer place-items-center rounded-full bg-surface-selected font-medium text-xs text-primary-subtle-text"
              >
                {initials}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-10 z-10 flex w-56 flex-col gap-1 rounded-md border border-border bg-surface-raised p-1 shadow-popover">
                  <p className="px-2 py-1 text-xs text-text-secondary">{name}</p>
                  <p className="px-2 pt-2 text-xs text-text-secondary">Theme</p>
                  {(['light', 'dark', 'system'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => chooseTheme(option)}
                      className={`rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-hover ${theme === option ? 'font-medium' : ''}`}
                    >
                      {option === 'light' ? 'Light' : option === 'dark' ? 'Dark' : 'System'}
                    </button>
                  ))}
                  <button type="button" onClick={logOut} className="rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-hover">
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
