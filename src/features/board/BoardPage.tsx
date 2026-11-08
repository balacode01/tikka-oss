import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { useSession } from '../../app/session-context'
import { supabase } from '../../lib/supabase'
import { BoardColumn } from './BoardColumn'
import { CardBody, type SubtaskProgress } from './IssueCard'
import { CreateIssueDialog } from './CreateIssueDialog'
import { IssuePanel } from './IssuePanel'
import { useActiveSprint, useBoard, useMoveIssue, useProjectSprints, useWorkspaceMembers, type BoardIssue, type BoardMember, type ProjectOption } from './useBoard'

// Sprint board, following the "Board" artboard: sprint header with progress, filter bar, columns.
// With an active sprint, the board shows that sprint's issues. Without one, it shows every issue.
export function BoardPage() {
  const { workspace = '', key = '' } = useParams()
  const board = useBoard(workspace, key)
  const members = useWorkspaceMembers(board.data?.project.workspace_id)
  const sprints = useProjectSprints(board.data?.project.id)
  const activeSprint = useActiveSprint(board.data?.project.id)
  const move = useMoveIssue({ workspaceSlug: workspace, projectKey: key })
  const queryClient = useQueryClient()
  const { session } = useSession()
  const currentUserId = session?.user.id
  // ?issue=KEY opens that issue's panel (set by quick search and shared links).
  const [searchParams, setSearchParams] = useSearchParams()

  // Captured once per visit, so the "days left" count does not change on every render.
  const [openedAt] = useState(() => Date.now())
  const [createOpen, setCreateOpen] = useState(false)
  const [createStatusId, setCreateStatusId] = useState<string | undefined>(undefined)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [openIssueId, setOpenIssueId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [epicFilter, setEpicFilter] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // Keyboard shortcut C opens Create issue, unless the user is typing.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault()
        setCreateStatusId(undefined)
        setCreateOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const completeSprint = useMutation({
    mutationFn: async (sprintId: string) => {
      const { error } = await supabase.rpc('complete_sprint', { p_sprint: sprintId, p_move_open_to: null })
      if (error) throw error
    },
    onSuccess: () => {
      toast('Sprint completed. Open issues moved to the backlog.')
      queryClient.invalidateQueries({ queryKey: ['board', workspace, key] })
      queryClient.invalidateQueries({ queryKey: ['active-sprint'] })
    },
    onError: (error) => toast(error.message),
  })

  const memberMap = useMemo(() => {
    const map = new Map<string, BoardMember>()
    for (const m of members.data ?? []) map.set(m.id, m)
    return map
  }, [members.data])

  if (board.isPending) return <p className="text-sm text-text-secondary">Loading the board</p>
  if (board.isError) return <p role="alert" className="text-sm text-danger-text">The board could not load. Refresh the page to try again.</p>
  if (!board.data) {
    return <p className="text-sm text-text-secondary">This project was not found, or you cannot see it.</p>
  }

  const { project, statuses, issues } = board.data
  const issueKey = searchParams.get('issue')
  const issueFromUrl = issueKey ? issues.find((i) => i.key === issueKey)?.id ?? null : null
  const todo = statuses.find((s) => s.category === 'todo')
  const doneIds = new Set(statuses.filter((s) => s.category === 'done').map((s) => s.id))
  const sprint = activeSprint.data

  // Scope: the active sprint's issues, or every issue when no sprint is active.
  const scoped = sprint ? issues.filter((i) => i.sprint_id === sprint.id) : issues

  const subtaskCounts = new Map<string, SubtaskProgress>()
  for (const issue of issues) {
    if (!issue.parent_id) continue
    const progress = subtaskCounts.get(issue.parent_id) ?? { done: 0, total: 0 }
    progress.total += 1
    if (doneIds.has(issue.status_id)) progress.done += 1
    subtaskCounts.set(issue.parent_id, progress)
  }

  const epicTitles = new Map<string, string>()
  for (const issue of issues) if (issue.type === 'epic') epicTitles.set(issue.id, issue.title)

  const epicOptions: ProjectOption[] = issues
    .filter((i) => i.type === 'epic')
    .map((i) => ({ id: i.id, key: i.key, title: i.title }))

  // Filter bar: text, assignee, only mine, type and epic.
  const needle = filterText.trim().toLowerCase()
  const cards = scoped.filter((i) => {
    if (i.type === 'subtask') return false
    if (needle && !(i.title.toLowerCase().includes(needle) || i.key.toLowerCase().includes(needle))) return false
    if (onlyMine && i.assignee_id !== currentUserId) return false
    if (assigneeFilter && i.assignee_id !== assigneeFilter) return false
    if (typeFilter && i.type !== typeFilter) return false
    if (epicFilter && i.epic_id !== epicFilter) return false
    return true
  })

  const byStatus = new Map<string, BoardIssue[]>()
  for (const status of statuses) byStatus.set(status.id, [])
  for (const issue of cards) byStatus.get(issue.status_id)?.push(issue)

  // Sprint progress across the sprint's issues (sub-tasks included), by status category.
  const sprintIssues = scoped
  const doneCount = sprintIssues.filter((i) => doneIds.has(i.status_id)).length
  const progressCount = sprintIssues.filter((i) => statuses.find((s) => s.id === i.status_id)?.category === 'in_progress').length
  const todoCount = sprintIssues.length - doneCount - progressCount
  const totalPoints = sprintIssues.reduce((sum, i) => sum + (i.story_points ?? 0), 0)
  const daysLeft = sprint?.end_date
    ? Math.max(0, Math.ceil((new Date(sprint.end_date).getTime() - openedAt) / 86400000))
    : null
  const sprintRange = sprint?.start_date && sprint?.end_date
    ? `${formatDay(sprint.start_date)} – ${formatDay(sprint.end_date)}`
    : null

  const activeIssue = activeId ? cards.find((i) => i.id === activeId) : undefined
  const memberIds = [...new Set(scoped.map((i) => i.assignee_id).filter((id): id is string => Boolean(id)))]

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const issue = cards.find((i) => i.id === active.id)
    if (!issue) return

    // Dropped on a column, or on a card inside a column.
    const statusId = (over.data.current?.statusId as string | undefined)
      ?? cards.find((i) => i.id === over.id)?.status_id
    if (!statusId) return

    let before: string | null
    let after: string | null

    if (statusId === issue.status_id) {
      // Reorder inside the same column: move the card in the list, then read its new neighbours.
      const column = byStatus.get(statusId) ?? []
      const from = column.findIndex((i) => i.id === issue.id)
      const to = column.findIndex((i) => i.id === over.id)
      if (from === -1 || to === -1 || from === to) return

      const reordered = arrayMove(column, from, to)
      before = reordered[to - 1]?.id ?? null
      after = reordered[to + 1]?.id ?? null
    } else {
      // Move to another column: the card lands above the card it was dropped on, or at the end.
      const column = (byStatus.get(statusId) ?? []).filter((i) => i.id !== issue.id)
      const overIndex = column.findIndex((i) => i.id === over.id)
      const index = overIndex === -1 ? column.length : overIndex
      before = column[index - 1]?.id ?? null
      after = column[index]?.id ?? null
    }

    move.mutate(
      { issueId: issue.id, statusId, beforeId: before, afterId: after },
      {
        onError: (error) => toast(error.message || 'That move was not saved. Try again.'),
      },
    )
  }

  return (
    <div className="-m-6 flex min-h-screen flex-1 flex-col">
      <header className="flex flex-col gap-3 border-border border-b bg-surface-selected px-6 py-4">
        <p className="text-[13px] leading-[18px] text-text-secondary">
          {project.name} <span className="mx-1">/</span> Board
        </p>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-xl">{sprint ? sprint.name : 'Board'}</h1>
              {sprint && (
                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-status-done-text">Active</span>
              )}
            </div>
            {sprint?.goal && (
              <p className="text-[13px] leading-[18px] text-text-secondary">
                <span className="font-medium text-text-primary">Sprint goal:</span> {sprint.goal}
              </p>
            )}
          </div>
          {sprint && (
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-text-secondary tabular-nums">
                {sprintRange}
                {daysLeft !== null && <> · <span className="font-medium text-text-primary">{daysLeft} days left</span></>}
              </span>
              <Button onClick={() => completeSprint.mutate(sprint.id)} disabled={completeSprint.isPending}>
                Complete sprint
              </Button>
            </div>
          )}
        </div>
        {sprint && (
          <div className="flex flex-col gap-2">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border">
              {doneCount > 0 && <span className="bg-status-done" style={{ width: `${(doneCount / sprintIssues.length) * 100}%` }} />}
              {progressCount > 0 && <span className="bg-status-progress" style={{ width: `${(progressCount / sprintIssues.length) * 100}%` }} />}
            </div>
            <div className="flex items-center gap-4 text-[13px] text-text-secondary tabular-nums">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-status-done" />{doneCount} done</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-status-progress" />{progressCount} in progress</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-status-todo" />{todoCount} to do</span>
              <span className="ml-auto">{totalPoints} points</span>
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2 border-border border-b bg-surface-page px-6 py-3">
        <label className="flex h-8 w-64 items-center gap-2 rounded-sm border border-border-strong bg-surface-raised px-2.5">
          <Search className="size-4 text-text-secondary" aria-hidden="true" />
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter board"
            aria-label="Filter board"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary"
          />
        </label>

        <div className="flex items-center -space-x-1.5 pl-2">
          {memberIds.slice(0, 6).map((id) => {
            const m = memberMap.get(id)
            if (!m) return null
            const selected = assigneeFilter === id
            return (
              <button
                key={id}
                type="button"
                title={m.name}
                aria-label={`Show issues for ${m.name}`}
                aria-pressed={selected}
                onClick={() => setAssigneeFilter(selected ? null : id)}
                className={`grid size-7 cursor-pointer place-items-center rounded-full border-2 text-[10px] font-medium text-primary-subtle-text ${selected ? 'border-primary bg-surface-selected' : 'border-surface-page bg-surface-selected'}`}
              >
                {m.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          aria-pressed={onlyMine}
          onClick={() => setOnlyMine((v) => !v)}
          className={`h-8 cursor-pointer rounded-sm border px-3 text-sm ${onlyMine ? 'border-primary bg-surface-selected text-primary-subtle-text' : 'border-border-strong bg-surface-raised text-text-primary hover:bg-surface-hover'}`}
        >
          Only my issues
        </button>

        <label className="h-8">
          <span className="sr-only">Type</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary"
          >
            <option value="">Type</option>
            <option value="story">Story</option>
            <option value="task">Task</option>
            <option value="bug">Bug</option>
            <option value="epic">Epic</option>
          </select>
        </label>

        <label className="h-8">
          <span className="sr-only">Epic</span>
          <select
            value={epicFilter}
            onChange={(e) => setEpicFilter(e.target.value)}
            className="h-8 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary"
          >
            <option value="">Epic</option>
            {epicOptions.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-[13px] text-text-secondary tabular-nums">{cards.length} issues</span>
      </div>

      <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto bg-surface-page p-6">
        {scoped.length === 0 && (
          <section className="flex w-full flex-col items-center gap-3 rounded-md border border-border bg-surface-raised p-8 text-center">
            <h2 className="font-medium text-base">No issues yet</h2>
            <p className="text-sm text-text-secondary">Create your first issue to start tracking work on this board.</p>
            <Button onClick={() => { setCreateStatusId(undefined); setCreateOpen(true) }}>Create</Button>
          </section>
        )}
        {scoped.length > 0 && (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            {statuses.map((status) => (
              <BoardColumn
                key={status.id}
                status={status}
                issues={byStatus.get(status.id) ?? []}
                members={memberMap}
                subtasks={subtaskCounts}
                epicTitles={epicTitles}
                onOpen={setOpenIssueId}
                onCreate={(statusId) => { setCreateStatusId(statusId); setCreateOpen(true) }}
              />
            ))}

            <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
              {activeIssue && (
                <div className="flex w-[264px] cursor-grabbing flex-col gap-2 rounded-md border border-border-strong bg-surface-raised p-3 text-sm shadow-modal">
                  <CardBody
                    issue={activeIssue}
                    assignee={activeIssue.assignee_id ? memberMap.get(activeIssue.assignee_id) : undefined}
                    subtasks={subtaskCounts.get(activeIssue.id) ?? { done: 0, total: 0 }}
                    epicTitle={activeIssue.epic_id ? epicTitles.get(activeIssue.epic_id) : undefined}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <CreateIssueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={project.id}
        workspaceSlug={workspace}
        projectKey={key}
        currentUserId={currentUserId}
        members={members.data ?? []}
        statuses={statuses}
        sprints={sprints.data ?? []}
        epics={epicOptions}
        todoStatusId={todo?.id}
        defaultStatusId={createStatusId}
      />

      <IssuePanel
        issueId={openIssueId ?? issueFromUrl}
        onClose={() => { setOpenIssueId(null); setSearchParams({}) }}
        workspaceSlug={workspace}
        projectKey={key}
        projectId={project.id}
        currentUserId={currentUserId}
        statuses={statuses}
        members={members.data ?? []}
        sprints={sprints.data ?? []}
        epics={epicOptions}
      />
    </div>
  )
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
