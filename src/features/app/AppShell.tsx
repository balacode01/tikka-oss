import { Bell, ChevronDown, ChevronRight, ChevronsUpDown, LayoutGrid, Layers, List, Search, Settings, User, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../app/session-context'
import { readThemePreference, applyTheme, saveThemePreference, type ThemePreference } from '../../app/theme'
import { useWorkspaceProjects } from './useWorkspaceProjects'
import { QuickSearch } from '../search/QuickSearch'

// Sidebar and top bar follow the "Board" artboard in the design canvas (indigo sidebar).
const navBase = 'flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] leading-[18px] text-on-primary hover:bg-primary-hover'
const navActive = 'bg-surface-raised font-medium text-primary'

function tile(letter: string) {
  return (
    <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-surface-raised text-[11px] font-semibold text-primary">
      {letter}
    </span>
  )
}

export function AppShell() {
  const { workspace = '', key = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useSession()
  const { data } = useWorkspaceProjects(workspace || undefined)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference())
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [searchOpen, setSearchOpen] = useState(false)

  // Ctrl+K (or Cmd+K) opens quick search from anywhere in the app.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const name = (session?.user.user_metadata?.display_name as string | undefined) ?? session?.user.email ?? 'You'
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  const workspaceName = data?.workspace?.name ?? 'Tikka'

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
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col self-start bg-primary text-on-primary" aria-label="Sidebar">
        <div className="flex shrink-0 items-center gap-2.5 border-white/15 border-b px-3 py-3">
          <span className="grid size-6 place-items-center rounded-sm bg-surface-raised text-[11px] font-semibold text-primary">
            {workspaceName.slice(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{workspaceName}</span>
          <ChevronsUpDown className="size-4 opacity-80" aria-hidden="true" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <nav className="flex flex-col gap-0.5 p-2">
          <NavLink to="/home" className={({ isActive }) => `${navBase} ${isActive ? navActive : ''}`}>
            <User className="size-4" aria-hidden="true" />
            Your work
          </NavLink>
        </nav>

        <div className="flex flex-col gap-0.5 p-2">
          <p className="px-2.5 pt-3 pb-1 text-[13px] leading-[18px] font-medium">Projects</p>
          {(data?.projects ?? []).map((p) => {
            const open = collapsed[p.id] === undefined ? p.key === key : !collapsed[p.id]
            const isCurrent = p.key === key
            return (
              <div key={p.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setCollapsed((c) => ({ ...c, [p.id]: open }))}
                  className={`${navBase} w-full`}
                >
                  {open ? <ChevronDown className="size-3.5" aria-hidden="true" /> : <ChevronRight className="size-3.5" aria-hidden="true" />}
                  {tile(p.key.slice(0, 1))}
                  <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
                </button>
                {open && (
                  <div className="ml-6 flex flex-col gap-0.5 border-white/30 border-l pl-2">
                    <NavLink
                      to={`/w/${workspace}/p/${p.key}/board`}
                      className={({ isActive }) => `${navBase} ${isActive || (isCurrent && location.pathname.endsWith('/board')) ? navActive : ''}`}
                    >
                      <LayoutGrid className="size-4" aria-hidden="true" />
                      Board
                    </NavLink>
                    <NavLink
                      to={`/w/${workspace}/p/${p.key}/backlog`}
                      className={({ isActive }) => `${navBase} ${isActive ? navActive : ''}`}
                    >
                      <Layers className="size-4" aria-hidden="true" />
                      Backlog
                    </NavLink>
                    <button type="button" onClick={() => toast('List view is not part of the MVP')} className={navBase}>
                      <List className="size-4" aria-hidden="true" />
                      List
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        </div>

        <div className="flex shrink-0 flex-col gap-0.5 border-white/15 border-t p-2">
          <button type="button" onClick={() => toast('Invites are not part of the MVP')} className={navBase}>
            <UserPlus className="size-4" aria-hidden="true" />
            Invite people
          </button>
          <button type="button" onClick={() => toast('Workspace settings are not part of the MVP')} className={navBase}>
            <Settings className="size-4" aria-hidden="true" />
            Workspace settings
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-3 border-border border-b bg-surface-selected px-6">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search issues (Ctrl or Cmd+K)"
            className="flex h-8 w-80 cursor-pointer items-center gap-2 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-secondary"
          >
            <Search className="size-4" aria-hidden="true" />
            Search issues
            <kbd className="ml-auto rounded-sm border border-border px-1.5 font-mono text-[11px]">Ctrl K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => toast('Create is available on the Board')}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
            >
              + Create
            </button>
            <button type="button" aria-label="Notifications" className="grid size-8 place-items-center rounded-sm text-text-secondary hover:bg-surface-hover">
              <Bell className="size-5" aria-hidden="true" />
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="grid size-8 cursor-pointer place-items-center rounded-full bg-surface-raised text-xs font-medium text-primary"
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
        <QuickSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          workspaceId={data?.workspace?.id}
          workspaceSlug={workspace}
          projects={data?.projects ?? []}
        />
        <main className="flex min-w-0 flex-1 flex-col p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
