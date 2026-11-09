import { Dialog } from '@base-ui/react/dialog'
import { Search } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { useRecentIssues, useSearchResults, type RecentIssue, type SearchIssue, type SearchProject } from './useQuickSearch'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string | undefined
  workspaceSlug: string
  projects: { id: string; key: string; name: string }[]
}

type Item =
  | { kind: 'issue'; key: string; title: string; projectKey: string; projectName: string; id: string }
  | { kind: 'project'; key: string; name: string }

// Quick search (Ctrl or Cmd+K). Arrow keys move, Enter opens, Esc closes.
export function QuickSearch({ open, onOpenChange, workspaceId, workspaceSlug, projects }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = useSearchResults(workspaceId, query)
  const recent = useRecentIssues(open && query.trim().length === 0)

  // Issues and projects, in the order they are shown. Recent issues appear when the query is empty.
  const items: Item[] = useMemo(() => {
    const projectById = new Map(projects.map((p) => [p.id, p]))
    const list: Item[] = []
    const issueRows: (SearchIssue | RecentIssue)[] = query.trim() ? results.data?.issues ?? [] : recent.data ?? []
    for (const issue of issueRows) {
      const project = projectById.get(issue.project_id)
      if (!project) continue
      list.push({ kind: 'issue', id: issue.id, key: issue.key, title: issue.title, projectKey: project.key, projectName: project.name })
    }
    if (query.trim()) {
      for (const p of (results.data?.projects ?? []) as SearchProject[]) {
        list.push({ kind: 'project', key: p.key, name: p.name })
      }
    }
    return list
  }, [query, results.data, recent.data, projects])

  function openItem(item: Item) {
    onOpenChange(false)
    setQuery('')
    if (item.kind === 'issue') {
      navigate(`/w/${workspaceSlug}/p/${item.projectKey}/board?issue=${item.key}`)
    } else {
      navigate(`/w/${workspaceSlug}/p/${item.key}/board`)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter' && items[active]) {
      event.preventDefault()
      openItem(items[active])
    }
  }

  const issueItems = items.filter((i): i is Extract<Item, { kind: 'issue' }> => i.kind === 'issue')
  const projectItems = items.filter((i): i is Extract<Item, { kind: 'project' }> => i.kind === 'project')
  const isSearching = query.trim().length > 0

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) setQuery(''); onOpenChange(next) }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/30" />
        <Dialog.Popup className="fixed top-24 left-1/2 z-50 flex max-h-[70vh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface-raised text-text-primary shadow-modal">
          <Dialog.Title className="sr-only">Search issues and projects</Dialog.Title>
          <div className="flex items-center gap-3 border-border border-b px-4 py-3">
            <Search className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0) }}
              onKeyDown={onKeyDown}
              placeholder="Search issues, projects and actions"
              aria-label="Search issues and projects"
              aria-activedescendant={items[active] ? `qs-${active}` : undefined}
              className="min-w-0 flex-1 bg-transparent text-base text-text-primary placeholder:text-text-secondary"
            />
            <kbd className="rounded-sm border border-border px-1.5 font-mono text-[11px] text-text-secondary">Esc</kbd>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2" role="listbox" aria-label="Results">
            {!isSearching && recent.data && recent.data.length > 0 && (
              <p className="px-4 pt-2 pb-1 text-[13px] text-text-secondary">Recent</p>
            )}
            {isSearching && issueItems.length > 0 && <p className="px-4 pt-2 pb-1 text-[13px] text-text-secondary">Issues</p>}
            {issueItems.map((item) => {
              const index = items.indexOf(item)
              return (
                <button
                  key={`issue-${item.id}`}
                  id={`qs-${index}`}
                  role="option"
                  aria-selected={index === active}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => openItem(item)}
                  className={`flex items-center gap-3 px-4 py-2 text-left text-sm ${index === active ? 'bg-surface-selected' : ''}`}
                >
                  <span className="font-mono text-xs text-text-secondary">{item.key}</span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="text-[13px] text-text-secondary">{item.projectName}</span>
                </button>
              )
            })}

            {isSearching && projectItems.length > 0 && <p className="px-4 pt-3 pb-1 text-[13px] text-text-secondary">Projects</p>}
            {projectItems.map((item) => {
              const index = items.indexOf(item)
              return (
                <button
                  key={`project-${item.key}`}
                  id={`qs-${index}`}
                  role="option"
                  aria-selected={index === active}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => openItem(item)}
                  className={`flex items-center gap-3 px-4 py-2 text-left text-sm ${index === active ? 'bg-surface-selected' : ''}`}
                >
                  <span className="font-mono text-xs text-text-secondary">{item.key}</span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                </button>
              )
            })}

            {isSearching && !results.isPending && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">
                No results for &ldquo;{query.trim()}&rdquo;. Try an issue key like MOB-142.
              </p>
            )}
            {!isSearching && (recent.data ?? []).length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">Issues you open will appear here.</p>
            )}
          </div>

          <div className="flex items-center gap-4 border-border border-t bg-surface-page px-4 py-2 text-[13px] text-text-secondary">
            <span>Arrow keys to move</span>
            <span>Enter to open</span>
            {isSearching && <span className="ml-auto tabular-nums">{items.length} results</span>}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
