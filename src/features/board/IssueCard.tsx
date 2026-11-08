import { useSortable } from '@dnd-kit/sortable'
import { Bookmark, Bug, CircleAlert, CornerDownRight, MessageSquare, SignalHigh, SignalLow, SignalMedium, SquareCheck, Zap, type LucideIcon } from 'lucide-react'
import type { BoardIssue, BoardMember } from './useBoard'

const TYPE_ICON: Record<BoardIssue['type'], { icon: LucideIcon; color: string; label: string }> = {
  epic: { icon: Zap, color: 'text-type-epic', label: 'Epic' },
  story: { icon: Bookmark, color: 'text-type-story', label: 'Story' },
  task: { icon: SquareCheck, color: 'text-type-task', label: 'Task' },
  bug: { icon: Bug, color: 'text-type-bug', label: 'Bug' },
  subtask: { icon: CornerDownRight, color: 'text-type-subtask', label: 'Sub-task' },
}

const PRIORITY: Record<BoardIssue['priority'], { icon: LucideIcon; label: string; color: string }> = {
  urgent: { icon: CircleAlert, label: 'Urgent', color: 'text-danger' },
  high: { icon: SignalHigh, label: 'High', color: 'text-text-secondary' },
  medium: { icon: SignalMedium, label: 'Medium', color: 'text-text-secondary' },
  low: { icon: SignalLow, label: 'Low', color: 'text-text-secondary' },
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

// The visible card. Used in the column and as the floating preview while dragging.
export function CardBody({ issue, assignee, subtasks }: { issue: BoardIssue; assignee?: BoardMember; subtasks: number }) {
  const type = TYPE_ICON[issue.type]
  const priority = PRIORITY[issue.priority]
  const TypeIcon = type.icon
  const PriorityIcon = priority.icon

  return (
    <>
      <div className="flex items-center gap-1.5">
        <TypeIcon className={`size-4 shrink-0 ${type.color}`} aria-hidden="true" />
        <span className="sr-only">{type.label}</span>
        <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
      </div>

      <p className="line-clamp-2 font-medium text-text-primary" title={issue.title}>
        {issue.title}
      </p>

      <div className="flex items-center gap-2 text-[13px] leading-[18px] text-text-secondary tabular-nums">
        <PriorityIcon className={`size-4 ${priority.color}`} aria-hidden="true" />
        <span className="sr-only">{priority.label} priority</span>
        {issue.story_points !== null && <span>{issue.story_points} pts</span>}
        {subtasks > 0 && <span>{subtasks} sub-tasks</span>}
        {issue.comments > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3.5" aria-hidden="true" />
            {issue.comments}
          </span>
        )}
        <span className="ml-auto">
          {assignee ? (
            <span
              title={assignee.name}
              className="grid size-6 place-items-center rounded-full bg-surface-selected text-[10px] font-medium text-primary-subtle-text"
            >
              {initials(assignee.name)}
            </span>
          ) : (
            <span className="sr-only">Unassigned</span>
          )}
        </span>
      </div>
    </>
  )
}

type Props = {
  issue: BoardIssue
  assignee?: BoardMember
  subtasks: number
  onOpen?: (issueId: string) => void
}

// A card in its column. While it is dragged, the column keeps an empty slot and the
// floating preview (DragOverlay in BoardPage) follows the pointer. The real card never moves.
// A click (not a drag) opens the issue panel.
export function IssueCard({ issue, assignee, subtasks, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { statusId: issue.status_id },
  })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(issue.id)}
      className={[
        'flex touch-none cursor-grab flex-col gap-2 rounded-md border p-3 text-sm',
        isDragging
          ? 'border-dashed border-primary bg-surface-selected text-transparent'
          : 'border-border bg-surface-raised hover:border-border-strong',
      ].join(' ')}
    >
      {isDragging ? <span className="block h-16" aria-hidden="true" /> : <CardBody issue={issue} assignee={assignee} subtasks={subtasks} />}
    </article>
  )
}
