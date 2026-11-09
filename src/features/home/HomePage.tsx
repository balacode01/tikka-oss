import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check, CircleAlert, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useSession } from '../../app/session-context'
import { relativeTime } from '../../lib/relativeTime'
import { supabase } from '../../lib/supabase'
import { PRIORITY_ICON, TYPE_ICON } from '../board/issueIcons'
import { StatusPill } from '../board/StatusPill'
import { HomeSkeleton } from './HomeSkeleton'

type IssueType = 'epic' | 'story' | 'task' | 'bug' | 'subtask'
type Priority = 'urgent' | 'high' | 'medium' | 'low'
type StatusCategory = 'todo' | 'in_progress' | 'done'

type HomeIssue = {
  id: string
  key: string
  title: string
  type: IssueType
  priority: Priority
  due_date: string | null
  status: string
  status_category: StatusCategory
  project_name: string
  project_key: string
}

type HomeData = {
  assigned: HomeIssue[]
  due_this_week: { id: string; key: string; title: string; type: IssueType; due_date: string; project_key: string }[]
  projects: {
    id: string
    key: string
    name: string
    template: 'scrum' | 'kanban'
    active_sprint: { name: string; end_date: string | null; done: number; total: number; points_done: number; points_total: number } | null
    open_count: number
    in_review_count: number
    members: { id: string; display_name: string }[]
  }[]
  recently_viewed: { id: string; key: string; title: string; type: IssueType; viewed_at: string; project_name: string; project_key: string }[]
  recent_activity: {
    kind: 'change' | 'comment'
    key: string
    field: string | null
    new_value: string | null
    new_status: { name: string; category: StatusCategory } | null
    actor_name: string | null
    created_at: string
  }[]
}

const ACTIVITY_LABEL: Record<string, string> = {
  status_id: 'status',
  assignee_id: 'assignee',
  priority: 'priority',
  sprint_id: 'sprint',
  title: 'title',
  due_date: 'due date',
  story_points: 'story points',
  epic_id: 'epic',
  parent_id: 'parent',
  type: 'type',
  deleted_at: 'deletion',
}

const box = 'rounded-md border border-border bg-surface-raised'
const sectionTitle = 'font-medium text-[15px] text-text-primary'

// Your work, following the "Your work" design: assigned issues with tabs, your projects, recently viewed,
// due this week and activity. A new workspace with no projects gets the three-step checklist.
export function HomePage() {
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const { session } = useSession()

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
        .select('id, key, title, type, priority, due_date, status:statuses!inner(name, category), project:projects!inner(name, key, workspace_id)')
        .eq('assignee_id', me.user.id)
        .eq('project.workspace_id', workspace!.id)
        .eq('status.category', 'done')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []).map((row) => {
        const status = row.status as unknown as { name: string; category: StatusCategory }
        const project = row.project as unknown as { name: string; key: string }
        return {
          id: row.id,
          key: row.key,
          title: row.title,
          type: row.type,
          priority: row.priority,
          due_date: row.due_date,
          status: status.name,
          status_category: status.category,
          project_name: project.name,
          project_key: project.key,
        }
      })
    },
  })

  if (workspaces.isPending) return <HomeSkeleton />
  if (!workspace) return <NoWorkspace />
  // Wait for the home data, so empty states never show while it loads.
  if (home.isPending) return <HomeSkeleton />

  const data = home.data
  const noProjects = data && data.projects.length === 0
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="flex flex-col">
      <header className="-mx-6 -mt-6 flex items-baseline gap-3 border-border border-b bg-surface-selected px-6 py-4">
        <h1 className="font-semibold text-xl">Your work</h1>
        <span className="text-sm text-text-secondary">{today}</span>
      </header>

      {noProjects ? (
        <div className="mt-6">
          <Checklist workspaceSlug={workspace.slug} workspaceName={workspace.name} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h2 className={sectionTitle}>Assigned to you</h2>
              <div className="flex items-center gap-6 border-border border-b text-sm">
                <button type="button" onClick={() => setTab('open')} className={`-mb-px cursor-pointer border-b-2 pb-2 ${tab === 'open' ? 'border-primary font-medium text-primary' : 'border-transparent text-text-primary'}`}>
                  Open <span className="ml-1 tabular-nums text-text-secondary">{data?.assigned.length ?? 0}</span>
                </button>
                <button type="button" onClick={() => setTab('done')} className={`-mb-px cursor-pointer border-b-2 pb-2 ${tab === 'done' ? 'border-primary font-medium text-primary' : 'border-transparent text-text-primary'}`}>
                  Done recently
                </button>
              </div>
              <ul className={`${box} flex flex-col divide-y divide-border px-4`}>
                {tab === 'open' && (data?.assigned ?? []).length === 0 && (
                  <li className="py-3 text-sm text-text-secondary">Nothing is assigned to you. Issues you pick up will appear here.</li>
                )}
                {tab === 'done' && doneRecently.data?.length === 0 && (
                  <li className="py-3 text-sm text-text-secondary">No issues finished recently.</li>
                )}
                {(tab === 'open' ? data?.assigned ?? [] : doneRecently.data ?? []).map((issue) => (
                  <IssueRow key={issue.id} issue={issue} done={tab === 'done'} />
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className={sectionTitle}>Your projects</h2>
              <ul className="grid gap-3 lg:grid-cols-3">
                {(data?.projects ?? []).map((project) => (
                  <ProjectCard key={project.id} project={project} workspaceSlug={workspace.slug} />
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className={sectionTitle}>Recently viewed</h2>
              <ul className={`${box} flex flex-col divide-y divide-border px-4`}>
                {(data?.recently_viewed ?? []).length === 0 && <li className="py-3 text-sm text-text-secondary">Issues you open will appear here.</li>}
                {(data?.recently_viewed ?? []).map((issue) => (
                  <li key={issue.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <IssueTypeIcon type={issue.type} />
                    <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
                    <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                    <span className="hidden w-32 truncate text-text-secondary sm:block">{issue.project_name}</span>
                    <span className="w-24 text-right text-xs text-text-secondary">{relativeTime(issue.viewed_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className={box}>
              <div className="flex items-baseline justify-between gap-2 border-border border-b px-4 py-3">
                <h2 className="font-medium text-sm">Due this week</h2>
                <span className="text-xs text-text-secondary">{weekRangeLabel()}</span>
              </div>
              <ul className="flex flex-col divide-y divide-border px-4">
                {(data?.due_this_week ?? []).length === 0 && <li className="py-3 text-sm text-text-secondary">Nothing is due this week.</li>}
                {(data?.due_this_week ?? []).map((issue) => (
                  <li key={issue.id} className="flex flex-col gap-1 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2">
                        <IssueTypeIcon type={issue.type} />
                        <span className="font-mono text-text-secondary">{issue.key}</span>
                      </span>
                      <span className="text-text-secondary tabular-nums">{weekdayLabel(issue.due_date)}</span>
                    </div>
                    <span className="truncate text-sm">{issue.title}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={box}>
              <h2 className="border-border border-b px-4 py-3 font-medium text-sm">Activity</h2>
              <ul className="flex flex-col gap-4 px-4 py-4">
                {(data?.recent_activity ?? []).length === 0 && <li className="text-sm text-text-secondary">Changes to issues will appear here.</li>}
                {(data?.recent_activity ?? []).map((event, index) => (
                  <li key={`${event.key}-${event.created_at}-${index}`} className="flex gap-3 text-sm">
                    <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-selected text-[11px] font-medium">
                      {initials(event.actor_name ?? 'Someone')}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <ActivityText event={event} viewerId={session?.user.id} />
                      </p>
                      <span className="text-xs text-text-secondary">{relativeTime(event.created_at)}</span>
                    </div>
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

function IssueRow({ issue, done }: { issue: HomeIssue; done: boolean }) {
  const due = issue.due_date ? parseDay(issue.due_date) : null
  const overdue = !done && due !== null && due < startOfToday()

  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <IssueTypeIcon type={issue.type} />
      <span className="w-20 shrink-0 font-mono text-xs text-text-secondary">{issue.key}</span>
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>
      <span className="hidden w-32 shrink-0 truncate text-text-secondary lg:block">{issue.project_name}</span>
      <span className="hidden w-28 shrink-0 sm:block">
        <StatusPill status={{ name: issue.status, category: issue.status_category }} />
      </span>
      <PriorityBars priority={issue.priority} />
      <span className={`w-32 shrink-0 text-right text-xs tabular-nums ${overdue ? 'text-danger-text' : 'text-text-secondary'}`}>
        {overdue ? (
          <span className="inline-flex items-center gap-1 font-medium">
            <CircleAlert className="size-3.5" aria-hidden="true" />
            Overdue · {shortDate(due)}
          </span>
        ) : due ? (
          shortDate(due)
        ) : done ? (
          ''
        ) : (
          'No due date'
        )}
      </span>
    </li>
  )
}

function ProjectCard({ project, workspaceSlug }: { project: HomeData['projects'][number]; workspaceSlug: string }) {
  const sprint = project.active_sprint
  const percent = sprint && sprint.points_total > 0 ? Math.round((sprint.points_done / sprint.points_total) * 100) : 0
  const templateLabel = project.template === 'scrum' ? 'Scrum' : 'Kanban'

  return (
    <li className={`${box} flex flex-col gap-3 p-4`}>
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-selected text-sm font-medium">{project.name.slice(0, 1).toUpperCase()}</span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-sm">{project.name}</span>
          <span className="font-mono text-xs text-text-secondary">
            {project.key} · {templateLabel}
          </span>
        </div>
      </div>

      {project.template === 'scrum' ? (
        sprint ? (
          <div className="flex flex-col gap-2 text-sm">
            <span>
              {sprint.name}
              {sprint.end_date && <> · {daysLeftLabel(sprint.end_date)}</>}
            </span>
            <span className="tabular-nums">
              {sprint.points_done} of {sprint.points_total} points done
            </span>
            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-border">
              <span className="block h-full rounded-full bg-status-done" style={{ width: `${percent}%` }} />
            </span>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No active sprint</p>
        )
      ) : (
        <p className="text-sm tabular-nums">
          {project.open_count} open issues · {project.in_review_count} in review
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <AvatarStack members={project.members} />
        <Link to={`/w/${workspaceSlug}/p/${project.key}/board`} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
          Open board
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </li>
  )
}

function AvatarStack({ members }: { members: { id: string; display_name: string }[] }) {
  const shown = members.slice(0, 4)
  const extra = members.length - shown.length
  return (
    <span className="flex items-center">
      {shown.map((member) => (
        <span
          key={member.id}
          title={member.display_name}
          className="-ml-1.5 grid size-6 place-items-center rounded-full border-2 border-surface-raised bg-surface-selected text-[10px] font-medium first:ml-0"
        >
          {initials(member.display_name)}
        </span>
      ))}
      {extra > 0 && <span className="-ml-1.5 pl-2 text-xs text-text-secondary">+{extra}</span>}
    </span>
  )
}

function ActivityText({ event, viewerId }: { event: HomeData['recent_activity'][number]; viewerId?: string }) {
  const actor = event.actor_name ?? 'Someone'
  if (event.kind === 'comment') {
    return <span>{actor} commented on <IssueKey value={event.key} /></span>
  }
  if (event.field === 'status_id' && event.new_status) {
    return (
      <>
        <span>{actor} moved <IssueKey value={event.key} /> to</span>
        <StatusPill status={event.new_status} />
      </>
    )
  }
  if (event.field === 'assignee_id') {
    if (event.new_value && event.new_value === viewerId) return <span>{actor} assigned <IssueKey value={event.key} /> to you</span>
    if (!event.new_value) return <span>{actor} unassigned <IssueKey value={event.key} /></span>
    return <span>{actor} changed the assignee of <IssueKey value={event.key} /></span>
  }
  const label = event.field ? ACTIVITY_LABEL[event.field] ?? event.field : 'issue'
  return <span>{actor} changed the {label} of <IssueKey value={event.key} /></span>
}

function IssueKey({ value }: { value: string }) {
  return <span className="font-mono text-xs">{value}</span>
}

function IssueTypeIcon({ type }: { type: IssueType }) {
  const { icon: Icon, color, label } = TYPE_ICON[type]
  return (
    <>
      <Icon className={`size-4 shrink-0 ${color}`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </>
  )
}

function PriorityBars({ priority }: { priority: Priority }) {
  if (priority === 'urgent') {
    return (
      <span className="flex w-6 shrink-0 justify-center text-danger-text">
        <CircleAlert className="size-4" aria-hidden="true" />
        <span className="sr-only">Urgent priority</span>
      </span>
    )
  }
  const { icon: Icon, label } = PRIORITY_ICON[priority]
  return (
    <span className="flex w-6 shrink-0 justify-center text-text-secondary">
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">{label} priority</span>
    </span>
  )
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

// Due dates arrive as YYYY-MM-DD. Parsing them as local dates keeps them on the right day.
function parseDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function shortDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function weekdayLabel(value: string) {
  return parseDay(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function weekRangeLabel() {
  const today = startOfToday()
  return `${shortDate(today)} – ${shortDate(addDays(today, 7))}`
}

function daysLeftLabel(endDate: string) {
  const days = Math.round((parseDay(endDate).getTime() - startOfToday().getTime()) / 86400000)
  if (days < 0) return 'ended'
  if (days === 0) return 'ends today'
  return days === 1 ? '1 day left' : `${days} days left`
}

// Shown when the user has no workspace yet, for example after skipping onboarding. They can wait for
// an invite or create their own workspace.
function NoWorkspace() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-md border border-border bg-surface-raised p-8 text-center">
      <h1 className="font-semibold text-xl">You&rsquo;re not in a workspace yet</h1>
      <p className="text-sm text-text-secondary">Ask your team for an invite, or create a workspace of your own.</p>
      <Link to="/onboarding" className="flex h-8 items-center rounded-sm bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-hover">
        Create workspace
      </Link>
    </section>
  )
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
