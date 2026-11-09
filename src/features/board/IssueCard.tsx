import { useSortable } from '@dnd-kit/sortable'
import { CircleAlert, CornerDownRight, MessageSquare, Zap } from 'lucide-react'
import type { BoardIssue, BoardMember } from './useBoard'
import { PRIORITY_ICON, TYPE_ICON } from './issueIcons'

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export type SubtaskProgress = { done: number; total: number }

type BodyProps = {
  issue: BoardIssue
  assignee?: BoardMember
  subtasks: SubtaskProgress
  epicTitle?: string
}

// The visible card. Used in the column and as the floating preview while dragging.
export function CardBody({ issue, assignee, subtasks, epicTitle }: BodyProps) {
  const type = TYPE_ICON[issue.type]
  const TypeIcon = type.icon
  const priority = issue.priority === 'urgent' ? null : PRIORITY_ICON[issue.priority]
  const PriorityIcon = priority?.icon

  return (
    <>
      <div className="flex items-center gap-2">
        <TypeIcon className={`size-4 shrink-0 ${type.color}`} aria-hidden="true" />
        <span className="sr-only">{type.label}</span>
        <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
        {subtasks.total > 0 && (
          <span className="flex items-center gap-1 text-[13px] text-text-secondary tabular-nums">
            <CornerDownRight className="size-3.5" aria-hidden="true" />
            {subtasks.done}/{subtasks.total}
          </span>
        )}
        {issue.comments > 0 && (
          <span className="flex items-center gap-1 text-[13px] text-text-secondary tabular-nums">
            <MessageSquare className="size-3.5" aria-hidden="true" />
            {issue.comments}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {issue.priority === 'urgent' ? (
            <span className="flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger-text">
              <CircleAlert className="size-3.5" aria-hidden="true" />
              Urgent
            </span>
          ) : (
            PriorityIcon && (
              <>
                <PriorityIcon className="size-4 text-text-secondary" aria-hidden="true" />
                <span className="sr-only">{priority?.label} priority</span>
              </>
            )
          )}
          {assignee ? (
            <span
              title={assignee.name}
              className="grid size-6 place-items-center rounded-full bg-surface-selected text-[10px] font-medium text-primary-subtle-text"
            >
              {initials(assignee.name)}
            </span>
          ) : (
            <span className="size-6 rounded-full border border-dashed border-border-strong" aria-label="Unassigned" />
          )}
        </span>
      </div>

      <p className="line-clamp-2 text-sm leading-5 text-text-primary" title={issue.title}>
        {issue.title}
      </p>

      <div className="flex items-center gap-2">
        {epicTitle && (
          <span className="flex min-w-0 items-center gap-1 rounded-sm bg-surface-hover px-2 py-0.5 text-[13px] text-text-secondary">
            <Zap className="size-3.5 shrink-0 text-type-epic" aria-hidden="true" />
            <span className="truncate">{epicTitle}</span>
          </span>
        )}
        {issue.story_points !== null && (
          <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-surface-hover px-1.5 text-xs font-medium text-text-primary tabular-nums">
            {issue.story_points}
          </span>
        )}
      </div>
    </>
  )
}

type Props = BodyProps & {
  onOpen?: (issueId: string) => void
}

// A card in its column. While it is dragged, the column keeps an empty slot and the
// floating preview (DragOverlay in BoardPage) follows the pointer. The real card never moves.
// A click (not a drag) opens the issue panel.
export function IssueCard({ onOpen, ...body }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: body.issue.id,
    data: { statusId: body.issue.status_id },
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
      onClick={() => onOpen?.(body.issue.id)}
      className={[
        'flex touch-none cursor-grab flex-col gap-2 rounded-md border p-3',
        isDragging
          ? 'border-dashed border-primary bg-surface-selected text-transparent'
          : 'border-border bg-surface-raised hover:border-border-strong',
      ].join(' ')}
    >
      {isDragging ? <span className="block h-20" aria-hidden="true" /> : <CardBody {...body} />}
    </article>
  )
}
