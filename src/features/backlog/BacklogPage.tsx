import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Bug, ChevronDown, ChevronRight, CornerDownRight, Plus, SignalHigh, SignalLow, SignalMedium, SquareCheck, Trash2, UserRound, Zap, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { useSession } from '../../app/session-context'
import { CreateIssueDialog } from '../board/CreateIssueDialog'
import type { ProjectOption } from '../board/useBoard'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { StatusPill } from '../board/StatusPill'
import { useBoard, useWorkspaceMembers, type BoardIssue, type BoardStatus, type BoardMember } from '../board/useBoard'
import { supabase } from '../../lib/supabase'
import { useBacklogSprints, useEpicProgress, type SprintRow } from './useBacklog'

const TYPE_ICON: Record<BoardIssue['type'], { icon: LucideIcon; color: string }> = {
  epic: { icon: Zap, color: 'text-type-epic' },
  story: { icon: Bookmark, color: 'text-type-story' },
  task: { icon: SquareCheck, color: 'text-type-task' },
  bug: { icon: Bug, color: 'text-type-bug' },
  subtask: { icon: CornerDownRight, color: 'text-type-subtask' },
}
const PRIORITY_ICON: Record<BoardIssue['priority'], LucideIcon> = {
  urgent: SignalHigh,
  high: SignalHigh,
  medium: SignalMedium,
  low: SignalLow,
}

// Backlog (M7): epics on the left, then sprint sections and the backlog. Rows can be reordered in the
// backlog and selected for bulk move, assign and delete. Sprints are started and completed here.
export function BacklogPage() {
  const { workspace = '', key = '' } = useParams()
  const queryClient = useQueryClient()
  const { session } = useSession()
  const [createIssueOpen, setCreateIssueOpen] = useState(false)
  const board = useBoard(workspace, key)
  const projectId = board.data?.project.id
  const members = useWorkspaceMembers(board.data?.project.workspace_id)
  const sprints = useBacklogSprints(projectId)
  const epics = useEpicProgress(projectId)
  const [epicFilter, setEpicFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [startFor, setStartFor] = useState<SprintRow | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['board', workspace, key] })
    queryClient.invalidateQueries({ queryKey: ['backlog-sprints'] })
    queryClient.invalidateQueries({ queryKey: ['epic-progress'] })
    queryClient.invalidateQueries({ queryKey: ['active-sprint'] })
  }

  const reorder = useMutation({
    mutationFn: async ({ id, statusId, before, after }: { id: string; statusId: string; before: string | null; after: string | null }) => {
      const { error } = await supabase.rpc('move_issue', { p_issue: id, p_status: statusId, p_before: before, p_after: after })
      if (error) throw error
    },
    onSuccess: refresh,
    onError: (error) => { toast(error.message); refresh() },
  })

  const bulk = useMutation({
    mutationFn: async (action: { kind: 'sprint'; sprint: string | null } | { kind: 'assignee'; assignee: string | null } | { kind: 'delete' }) => {
      const ids = [...selected]
      if (action.kind === 'delete') {
        const { error } = await supabase.rpc('delete_issues', { p_ids: ids })
        if (error) throw error
      } else if (action.kind === 'sprint') {
        const { error } = await supabase.rpc('bulk_update_issues', {
          p_ids: ids, p_sprint: action.sprint, p_assignee: null, p_set_sprint: true, p_set_assignee: false,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('bulk_update_issues', {
          p_ids: ids, p_sprint: null, p_assignee: action.assignee, p_set_sprint: false, p_set_assignee: true,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { setSelected(new Set()); refresh(); toast('Changes saved') },
    onError: (error) => toast(error.message),
  })

  const complete = useMutation({
    mutationFn: async (sprintId: string) => {
      const { error } = await supabase.rpc('complete_sprint', { p_sprint: sprintId, p_move_open_to: null })
      if (error) throw error
    },
    onSuccess: () => { refresh(); toast('Sprint completed. Open issues moved to the backlog.') },
    onError: (error) => toast(error.message),
  })

  if (board.isPending) return <p className="text-sm text-text-secondary">Loading the backlog</p>
  if (!board.data) return <p className="text-sm text-text-secondary">This project was not found, or you cannot see it.</p>

  const { project, statuses, issues } = board.data
  const doneIds = new Set(statuses.filter((s) => s.category === 'done').map((s) => s.id))
  const memberMap = new Map((members.data ?? []).map((m) => [m.id, m]))
  const sprintList = sprints.data ?? []
  const visible = issues.filter((i) => i.type !== 'subtask' && (!epicFilter || i.epic_id === epicFilter))
  const backlog = visible.filter((i) => !i.sprint_id).sort((a, b) => a.rank - b.rank)
  const statusById = new Map(statuses.map((s) => [s.id, s]))

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function onBacklogDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = backlog.findIndex((i) => i.id === active.id)
    const to = backlog.findIndex((i) => i.id === over.id)
    if (from < 0 || to < 0) return
    const reordered = arrayMove(backlog, from, to)
    const moved = reordered[to]
    reorder.mutate({
      id: moved.id,
      statusId: moved.status_id,
      before: reordered[to - 1]?.id ?? null,
      after: reordered[to + 1]?.id ?? null,
    })
  }

  function confirmDelete() {
    if (window.confirm(`Delete ${selected.size} issue${selected.size === 1 ? '' : 's'}? You can't undo this from the app.`)) {
      bulk.mutate({ kind: 'delete' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-text-secondary">{project.name} <span className="mx-1">/</span> Backlog</p>
          <h1 className="font-semibold text-xl">Backlog</h1>
        </div>
        <Button className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Create sprint
        </Button>
      </header>

      <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-6">
        <aside className="flex flex-col gap-1 self-start rounded-md border border-border bg-surface-raised p-3">
          <p className="px-2 pb-1 font-medium text-sm">Epics</p>
          <button
            type="button"
            onClick={() => setEpicFilter(null)}
            className={`flex justify-between rounded-sm px-2 py-1.5 text-sm ${epicFilter === null ? 'bg-surface-selected font-medium' : 'hover:bg-surface-hover'}`}
          >
            All issues <span className="tabular-nums text-text-secondary">{visible.length}</span>
          </button>
          {(epics.data ?? []).map((epic) => {
            const percent = epic.issue_count === 0 ? 0 : Math.round((epic.done_count / epic.issue_count) * 100)
            return (
              <button
                key={epic.id}
                type="button"
                onClick={() => setEpicFilter(epic.id)}
                className={`flex flex-col gap-1 rounded-sm px-2 py-1.5 text-left text-sm ${epicFilter === epic.id ? 'bg-surface-selected' : 'hover:bg-surface-hover'}`}
              >
                <span className="flex items-center gap-2"><Zap className="size-4 text-type-epic" aria-hidden="true" />{epic.title}</span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-border"><span className="block h-full bg-status-done" style={{ width: `${percent}%` }} /></span>
                <span className="text-xs text-text-secondary tabular-nums">{epic.done_count} of {epic.issue_count} done</span>
              </button>
            )
          })}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary bg-surface-selected px-4 py-2 text-sm">
              <span className="font-medium tabular-nums">{selected.size} selected</span>
              <Select
                aria-label="Move selected to"
                value=""
                onChange={(e) => {
                  if (e.target.value === 'backlog') bulk.mutate({ kind: 'sprint', sprint: null })
                  else if (e.target.value) bulk.mutate({ kind: 'sprint', sprint: e.target.value })
                }}
                className="w-44"
              >
                <option value="">Move to</option>
                <option value="backlog">Backlog</option>
                {sprintList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Select
                aria-label="Assign selected to"
                value=""
                onChange={(e) => {
                  if (e.target.value) bulk.mutate({ kind: 'assignee', assignee: e.target.value === 'none' ? null : e.target.value })
                }}
                className="w-44"
              >
                <option value="">Assign</option>
                <option value="none">Unassigned</option>
                {(members.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
              <button type="button" onClick={confirmDelete} className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm font-medium text-danger-text hover:underline">
                <Trash2 className="size-4" aria-hidden="true" />
                Delete
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-text-secondary hover:text-text-primary">Clear</button>
            </div>
          )}

          {sprintList.map((sprint) => {
            const items = visible.filter((i) => i.sprint_id === sprint.id)
            const points = items.reduce((sum, i) => sum + (i.story_points ?? 0), 0)
            const done = items.filter((i) => doneIds.has(i.status_id)).length
            const isOpen = !collapsed[sprint.id]
            return (
              <section key={sprint.id} className="flex flex-col rounded-md border border-border bg-surface-raised">
                <header className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => setCollapsed((c) => ({ ...c, [sprint.id]: isOpen }))} aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${sprint.name}`} className="cursor-pointer text-text-secondary">
                    {isOpen ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                  </button>
                  <span className="font-medium text-base">{sprint.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sprint.state === 'active' ? 'bg-status-done-bg text-status-done-text' : 'bg-status-todo-bg text-status-todo-text'}`}>
                    {sprint.state === 'active' ? 'Active' : 'Planned'}
                  </span>
                  <span className="text-[13px] text-text-secondary tabular-nums">
                    {sprint.start_date && sprint.end_date ? `${formatDay(sprint.start_date)} – ${formatDay(sprint.end_date)} · ` : ''}
                    {items.length} issues · {points} points · {done} done
                  </span>
                  <span className="ml-auto flex gap-2">
                    {sprint.state === 'planned' && (
                      <Button variant="primary" onClick={() => setStartFor(sprint)}>Start sprint</Button>
                    )}
                    {sprint.state === 'active' && (
                      <Button onClick={() => complete.mutate(sprint.id)} disabled={complete.isPending}>Complete sprint</Button>
                    )}
                  </span>
                </header>
                {isOpen && (
                  <ul className="flex flex-col divide-y divide-border border-border border-t">
                    {items.length === 0 && <li className="px-4 py-3 text-sm text-text-secondary">Drag issues here, or select them in the backlog and choose this sprint.</li>}
                    {items.map((issue) => (
                      <BacklogRow
                        key={issue.id}
                        issue={issue}
                        selected={selected.has(issue.id)}
                        onToggle={() => toggle(issue.id)}
                        status={statusById.get(issue.status_id)}
                        member={issue.assignee_id ? memberMap.get(issue.assignee_id) : undefined}
                        epicTitle={epicTitleOf(issues, issue)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )
          })}

          <section className="flex flex-col rounded-md border border-border bg-surface-raised">
            <header className="flex items-center gap-3 px-4 py-3">
              <span className="font-medium text-base">Backlog</span>
              <span className="text-[13px] text-text-secondary tabular-nums">{backlog.length} issues · {backlog.reduce((s, i) => s + (i.story_points ?? 0), 0)} points</span>
            </header>
            <DndContext sensors={sensors} onDragEnd={onBacklogDragEnd}>
              <SortableContext items={backlog.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col divide-y divide-border border-border border-t">
                  {backlog.map((issue) => (
                    <SortableBacklogRow
                      key={issue.id}
                      issue={issue}
                      selected={selected.has(issue.id)}
                      onToggle={() => toggle(issue.id)}
                      status={statusById.get(issue.status_id)}
                      member={issue.assignee_id ? memberMap.get(issue.assignee_id) : undefined}
                      epicTitle={epicTitleOf(issues, issue)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {backlog.length === 0 && <p className="border-border border-t px-4 py-3 text-sm text-text-secondary">The backlog is empty.</p>}
            <div className="border-border border-t px-4 py-3">
              <button type="button" onClick={() => setCreateIssueOpen(true)} className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-hover">
                <Plus className="size-4" aria-hidden="true" />
                Create issue
              </button>
            </div>
          </section>
        </div>
      </div>

      <CreateIssueDialog
        open={createIssueOpen}
        onOpenChange={setCreateIssueOpen}
        projectId={project.id}
        workspaceSlug={workspace}
        projectKey={key}
        currentUserId={session?.user.id}
        members={members.data ?? []}
        statuses={statuses}
        sprints={sprintList.map((s): ProjectOption => ({ id: s.id, key: '', title: s.name, state: s.state }))}
        epics={issues.filter((i) => i.type === 'epic').map((i): ProjectOption => ({ id: i.id, key: i.key, title: i.title }))}
        todoStatusId={statuses.find((s) => s.category === 'todo')?.id}
      />
      <CreateSprintDialog open={createOpen} onOpenChange={setCreateOpen} projectId={project.id} onCreated={refresh} />
      <StartSprintDialog sprint={startFor} onClose={() => setStartFor(null)} onStarted={refresh} />
    </div>
  )
}

function epicTitleOf(issues: BoardIssue[], issue: BoardIssue) {
  if (!issue.epic_id) return undefined
  return issues.find((i) => i.id === issue.epic_id)?.title
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function BacklogRow({ issue, selected, onToggle, status, member, epicTitle }: RowProps) {
  return (
    <li className="flex items-center gap-3 px-4 py-2 text-sm">
      <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${issue.key}`} className="size-4 accent-primary" />
      <RowContent issue={issue} status={status} member={member} epicTitle={epicTitle} />
    </li>
  )
}

function SortableBacklogRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.issue.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}
      className={`flex items-center gap-3 px-4 py-2 text-sm ${isDragging ? 'opacity-50' : ''}`}
    >
      <span {...attributes} {...listeners} className="cursor-grab text-text-secondary" aria-label={`Drag ${props.issue.key}`}>⋮⋮</span>
      <input type="checkbox" checked={props.selected} onChange={props.onToggle} aria-label={`Select ${props.issue.key}`} className="size-4 accent-primary" />
      <RowContent issue={props.issue} status={props.status} member={props.member} epicTitle={props.epicTitle} />
    </li>
  )
}

type RowProps = {
  issue: BoardIssue
  selected: boolean
  onToggle: () => void
  status?: BoardStatus
  member?: BoardMember
  epicTitle?: string
}

function RowContent({ issue, status, member, epicTitle }: Omit<RowProps, 'selected' | 'onToggle'>) {
  const TypeIcon = TYPE_ICON[issue.type].icon
  const PriorityIcon = PRIORITY_ICON[issue.priority]
  return (
    <>
      <TypeIcon className={`size-4 shrink-0 ${TYPE_ICON[issue.type].color}`} aria-hidden="true" />
      <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>
      {epicTitle && <span className="hidden truncate rounded-sm bg-surface-hover px-2 py-0.5 text-[13px] text-text-secondary md:inline">{epicTitle}</span>}
      {status && <StatusPill status={status} />}
      <span className="w-8 text-right text-xs text-text-secondary tabular-nums">{issue.story_points ?? ''}</span>
      <PriorityIcon className="size-4 text-text-secondary" aria-label={`${issue.priority} priority`} />
      {member ? (
        <span title={member.name} className="grid size-6 place-items-center rounded-full bg-surface-selected text-[10px] font-medium text-primary-subtle-text">
          {member.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      ) : (
        <UserRound className="size-4 text-text-secondary" aria-label="Unassigned" />
      )}
    </>
  )
}

function CreateSprintDialog({ open, onOpenChange, projectId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; projectId: string; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setPending(true)
    const { error } = await supabase.rpc('create_sprint', { p_project: projectId, p_name: name, p_goal: goal })
    setPending(false)
    if (error) return toast(error.message)
    setName('')
    setGoal('')
    onOpenChange(false)
    onCreated()
    toast('Sprint created')
  }

  if (!open) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="Create sprint" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => onOpenChange(false)}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6 text-text-primary shadow-modal">
        <h2 className="font-semibold text-xl">Create sprint</h2>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint 15" className="h-8 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Goal
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What should this sprint achieve?" className="h-8 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal" />
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={pending || !name.trim()}>Create sprint</Button>
        </div>
      </form>
    </div>
  )
}

function StartSprintDialog({ sprint, onClose, onStarted }: { sprint: SprintRow | null; onClose: () => void; onStarted: () => void }) {
  const [goal, setGoal] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pending, setPending] = useState(false)

  async function start(event: FormEvent) {
    event.preventDefault()
    if (!sprint) return
    setPending(true)
    const { error } = await supabase.rpc('start_sprint', { p_sprint: sprint.id, p_goal: goal || null, p_end_date: endDate || null })
    setPending(false)
    if (error) return toast(error.message)
    setGoal('')
    setEndDate('')
    onClose()
    onStarted()
    toast('Sprint started')
  }

  if (!sprint) return null
  return (
    <div role="dialog" aria-modal="true" aria-label="Start sprint" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={start} onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6 text-text-primary shadow-modal">
        <h2 className="font-semibold text-xl">Start {sprint.name}</h2>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Sprint goal
          <input value={goal} onChange={(e) => setGoal(e.target.value)} className="h-8 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          End date
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal" />
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={pending}>Start sprint</Button>
        </div>
      </form>
    </div>
  )
}
