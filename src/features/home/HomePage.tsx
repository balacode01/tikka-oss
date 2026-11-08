import { useQuery } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { supabase } from '../../lib/supabase'

type HomeIssue = { id: string; key: string; title: string; due_date: string | null; status: string }
type HomeData = {
  assigned: HomeIssue[]
  due_this_week: { id: string; key: string; title: string; due_date: string }[]
  projects: { id: string; key: string; name: string; active_sprint: { name: string; done: number; total: number } | null }[]
  recently_viewed: { id: string; key: string; title: string }[]
  recent_activity: { field: string; old_value: string | null; new_value: string | null; actor_id: string | null; created_at: string; key: string }[]
}

const card = 'flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4'

// Your work (M7): the home page from the design. Issues assigned to you, your projects, due this week,
// recently viewed and activity. A new workspace with no projects gets the three-step checklist.
export function HomePage() {
  const [tab, setTab] = useState<'open' | 'done'>('open')

  const workspaces = useQuery({
    queryKey: ['my-workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('id, name, slug').order('created_at')
      if (error) throw error
      return data
    },
  })
  const workspace = workspaces.data?.[0]

  const home = useQuery({
    queryKey: ['home', workspace?.id],
    enabled: Boolean(workspace),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('home', { p_workspace: workspace!.id })
      if (error) throw error
      return data as unknown as HomeData
    },
  })

  const doneRecently = useQuery({
    queryKey: ['done-recently', workspace?.id],
    enabled: Boolean(workspace) && tab === 'done',
    queryFn: async (): Promise<HomeIssue[]> => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) return []
      const { data, error } = await supabase
        .from('issues')
        .select('id, key, title, due_date, status:statuses!inner(name, category), project:projects!inner(workspace_id)')
        .eq('assignee_id', me.user.id)
        .eq('project.workspace_id', workspace!.id)
        .eq('status.category', 'done')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id,
        key: row.key,
        title: row.title,
        due_date: row.due_date,
        status: (row.status as unknown as { name: string }).name,
      }))
    },
  })

  if (workspaces.isPending) return <p className="text-sm text-text-secondary">Loading your work</p>
  if (!workspace) return <Navigate to="/onboarding" replace />

  const data = home.data
  const noProjects = data && data.projects.length === 0
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline gap-3">
        <h1 className="font-semibold text-xl">Your work</h1>
        <span className="text-[13px] text-text-secondary">{today}</span>
      </header>

      {noProjects ? (
        <Checklist workspaceSlug={workspace.slug} workspaceName={workspace.name} />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className={card}>
              <div className="flex items-center gap-4 border-border border-b">
                <button type="button" onClick={() => setTab('open')} className={`-mb-px border-b-2 pb-2 text-sm font-medium ${tab === 'open' ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary'}`}>
                  Assigned to you <span className="tabular-nums">{data?.assigned.length ?? 0}</span>
                </button>
                <button type="button" onClick={() => setTab('done')} className={`-mb-px border-b-2 pb-2 text-sm font-medium ${tab === 'done' ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary'}`}>
                  Done recently
                </button>
              </div>
              {tab === 'open' && (
                <ul className="flex flex-col divide-y divide-border">
                  {(data?.assigned ?? []).length === 0 && <li className="py-3 text-sm text-text-secondary">Nothing is assigned to you. Issues you pick up will appear here.</li>}
                  {(data?.assigned ?? []).map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </ul>
              )}
              {tab === 'done' && (
                <ul className="flex flex-col divide-y divide-border">
                  {(doneRecently.data ?? []).length === 0 && <li className="py-3 text-sm text-text-secondary">No issues finished recently.</li>}
                  {(doneRecently.data ?? []).map((issue) => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="font-medium text-sm">Your projects</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {(data?.projects ?? []).map((p) => (
                  <li key={p.id}>
                    <Link to={`/w/${workspace.slug}/p/${p.key}/board`} className={`${card} hover:bg-surface-hover`}>
                      <span className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded-sm bg-primary text-[11px] font-semibold text-on-primary">{p.key.slice(0, 1)}</span>
                        <span className="font-medium text-sm">{p.name}</span>
                        <span className="ml-auto font-mono text-xs text-text-secondary">{p.key}</span>
                      </span>
                      {p.active_sprint ? (
                        <>
                          <span className="text-[13px] text-text-secondary tabular-nums">{p.active_sprint.name}: {p.active_sprint.done} of {p.active_sprint.total} done</span>
                          <span className="h-1.5 w-full overflow-hidden rounded-full bg-border"><span className="block h-full bg-status-done" style={{ width: `${p.active_sprint.total === 0 ? 0 : Math.round((p.active_sprint.done / p.active_sprint.total) * 100)}%` }} /></span>
                        </>
                      ) : (
                        <span className="text-[13px] text-text-secondary">No active sprint</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="font-medium text-sm">Recently viewed</h2>
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface-raised">
                {(data?.recently_viewed ?? []).length === 0 && <li className="px-4 py-3 text-sm text-text-secondary">Issues you open will appear here.</li>}
                {(data?.recently_viewed ?? []).map((issue) => (
                  <li key={issue.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
                    <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className={card}>
              <h2 className="font-medium text-sm">Due this week</h2>
              <ul className="flex flex-col gap-2">
                {(data?.due_this_week ?? []).length === 0 && <li className="text-sm text-text-secondary">Nothing is due this week.</li>}
                {(data?.due_this_week ?? []).map((issue) => (
                  <li key={issue.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
                    <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                    <span className="text-xs text-text-secondary tabular-nums">{formatDay(issue.due_date)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={card}>
              <h2 className="font-medium text-sm">Activity</h2>
              <ul className="flex flex-col gap-3">
                {(data?.recent_activity ?? []).length === 0 && <li className="text-sm text-text-secondary">Changes to issues will appear here.</li>}
                {(data?.recent_activity ?? []).map((a, i) => (
                  <li key={`${a.key}-${a.created_at}-${i}`} className="text-sm">
                    <span className="font-mono text-xs text-text-secondary">{a.key}</span>{' '}
                    <span>{ACTIVITY_LABEL[a.field] ?? a.field} changed</span>
                    <span className="block text-xs text-text-secondary">{formatDay(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}

const ACTIVITY_LABEL: Record<string, string> = {
  status_id: 'Status',
  assignee_id: 'Assignee',
  priority: 'Priority',
  sprint_id: 'Sprint',
  title: 'Title',
  due_date: 'Due date',
  story_points: 'Story points',
  epic_id: 'Epic',
  parent_id: 'Parent',
  type: 'Type',
  deleted_at: 'Deletion',
}

function IssueRow({ issue }: { issue: HomeIssue }) {
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>
      <span className="hidden text-xs text-text-secondary sm:inline">{issue.status}</span>
      <span className="w-20 text-right text-xs text-text-secondary tabular-nums">{issue.due_date ? formatDay(issue.due_date) : ''}</span>
    </li>
  )
}

function formatDay(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// Welcome checklist for a new workspace with no projects yet. The first step is already done.
function Checklist({ workspaceSlug, workspaceName }: { workspaceSlug: string; workspaceName: string }) {
  const steps = [
    { title: 'Create your workspace', body: `${workspaceName} is ready.`, done: true },
    { title: 'Invite your team', body: 'Add the people you work with so you can assign them issues.', done: false, note: 'Invites are not part of the MVP yet.' },
    { title: 'Create your first project', body: "Set up a board and backlog for your team's work.", done: false, href: `/w/${workspaceSlug}/projects/new` },
  ]
  const doneCount = steps.filter((s) => s.done).length
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">Welcome to Tikka</h1>
        <p className="text-sm text-text-secondary">Three steps to get your team going</p>
      </div>
      <div className="flex flex-col rounded-md border border-border bg-surface-raised">
        <div className="flex flex-col gap-2 border-border border-b p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Set up {workspaceName}</span>
            <span className="text-text-secondary tabular-nums">{doneCount} of {steps.length} done</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border"><div className="h-full bg-status-done" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
        </div>
        {steps.map((step, index) => (
          <div key={step.title} className="flex items-center gap-4 border-border border-b p-4 last:border-b-0">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs ${step.done ? 'border-status-done bg-status-done-bg text-status-done-text' : 'border-border-strong text-text-secondary'}`}>
              {step.done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className={`text-sm font-medium ${step.done ? 'text-text-secondary' : ''}`}>{step.title}</span>
              <span className="text-[13px] text-text-secondary">{step.note ?? step.body}</span>
            </div>
            {step.href && (
              <Link to={step.href} className="flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-medium hover:bg-surface-hover">
                <Plus className="size-4" aria-hidden="true" />
                Create project
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
