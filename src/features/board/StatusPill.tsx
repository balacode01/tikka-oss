import type { BoardStatus } from './useBoard'

// Status pill from the design tokens: the name always shows, with a dot in the same colour.
const COLORS: Record<BoardStatus['category'], { pill: string; dot: string }> = {
  todo: { pill: 'bg-status-todo-bg text-status-todo-text', dot: 'bg-status-todo' },
  in_progress: { pill: 'bg-status-progress-bg text-status-progress-text', dot: 'bg-status-progress' },
  done: { pill: 'bg-status-done-bg text-status-done-text', dot: 'bg-status-done' },
}

export function StatusPill({ status }: { status: Pick<BoardStatus, 'name' | 'category'> }) {
  const colors = COLORS[status.category]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${colors.pill}`}>
      <span className={`size-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
      {status.name}
    </span>
  )
}
