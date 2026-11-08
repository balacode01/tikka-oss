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

type Props = {
  issue: BoardIssue
  assignee?: BoardMember
  subtasks: number
  onOpen?: (issue: BoardIssue) => void
}

// One card. dnd-kit moves it; the handle is the whole card, so keyboard drag works too.
export function IssueCard({ issue, assignee, subtasks, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { statusId: issue.status_id },
  })

  const type = TYPE_ICON[issue.type]
  const priority = PRIORITY[issue.priority]
  const TypeIcon = type.icon
  const PriorityIcon = priority.icon

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
      }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(issue)}
      className={[
        'flex cursor-grab flex-col gap-2 rounded-md border border-border bg-surface-raised p-3 text-sm',
        isDragging ? 'opacity-50 shadow-modal' : 'hover:border-border-strong',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <TypeIcon className={`size-4 shrink-0 ${type.color}`} aria-hidden="true" />
        <span className="sr-only">{type.label}</span>
        <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
      </div>

      <p className="line-clamp-2 font-medium text-text-primary" title={issue.title}>
        {issue.title}
      </p>

      <div className="flex items-center gap-2 text-xs text-text-secondary tabular-nums">
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
    </article>
  )
}
