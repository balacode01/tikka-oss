import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { arrayMove } from '@dnd-kit/sortable'
import { BoardColumn } from './BoardColumn'
import { CardBody } from './IssueCard'
import { CreateIssueDialog } from './CreateIssueDialog'
import { useBoard, useMoveIssue, useWorkspaceMembers, type BoardIssue, type BoardMember } from './useBoard'

// Columns come from the project's statuses. Cards are sorted by rank within each column.
export function BoardPage() {
  const { workspace = '', key = '' } = useParams()
  const board = useBoard(workspace, key)
  const members = useWorkspaceMembers(board.data?.project.workspace_id)
  const move = useMoveIssue({ workspaceSlug: workspace, projectKey: key })
  const [createOpen, setCreateOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

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
        setCreateOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const memberMap = useMemo(() => {
    const map = new Map<string, BoardMember>()
    for (const m of members.data ?? []) map.set(m.id, m)
    return map
  }, [members.data])

  const subtaskCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const issue of board.data?.issues ?? []) {
      if (issue.parent_id) counts.set(issue.parent_id, (counts.get(issue.parent_id) ?? 0) + 1)
    }
    return counts
  }, [board.data])

  if (board.isPending) return <p className="text-sm text-text-secondary">Loading the board</p>
  if (board.isError) return <p role="alert" className="text-sm text-danger-text">The board could not load. Refresh the page to try again.</p>
  if (!board.data) {
    return <p className="text-sm text-text-secondary">This project was not found, or you cannot see it.</p>
  }

  const { project, statuses, issues } = board.data
  const todo = statuses.find((s) => s.category === 'todo')
  const cards = issues
  const activeIssue = activeId ? cards.find((i) => i.id === activeId) : undefined

  const byStatus = new Map<string, BoardIssue[]>()
  for (const status of statuses) byStatus.set(status.id, [])
  for (const issue of cards) byStatus.get(issue.status_id)?.push(issue)

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-semibold text-xl">Board</h1>
          <p className="font-mono text-xs text-text-secondary">{project.key} · {project.name}</p>
        </div>
        <Button variant="primary" className="ml-auto" onClick={() => setCreateOpen(true)}>
          Create issue
        </Button>
      </div>

      {cards.length === 0 ? (
        <section className="flex flex-col items-start gap-3 rounded-md border border-border bg-surface-raised p-8">
          <h2 className="font-medium text-base">No issues yet</h2>
          <p className="text-sm text-text-secondary">Create your first issue to start tracking work on this board.</p>
        </section>
      ) : null}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => (
            <BoardColumn
              key={status.id}
              status={status}
              issues={byStatus.get(status.id) ?? []}
              members={memberMap}
              subtaskCounts={subtaskCounts}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
          {activeIssue && (
            <div className="flex w-[264px] cursor-grabbing flex-col gap-2 rounded-md border border-border-strong bg-surface-raised p-3 text-sm shadow-modal">
              <CardBody
                issue={activeIssue}
                assignee={activeIssue.assignee_id ? memberMap.get(activeIssue.assignee_id) : undefined}
                subtasks={subtaskCounts.get(activeIssue.id) ?? 0}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <CreateIssueDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={project.id}
        workspaceSlug={workspace}
        projectKey={key}
        members={members.data ?? []}
        todoStatusId={todo?.id}
      />
    </div>
  )
}
