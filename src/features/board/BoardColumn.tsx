import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { IssueCard } from './IssueCard'
import type { BoardIssue, BoardMember, BoardStatus } from './useBoard'

const DOT: Record<BoardStatus['category'], string> = {
  todo: 'bg-status-todo',
  in_progress: 'bg-status-progress',
  done: 'bg-status-done',
}

type Props = {
  status: BoardStatus
  issues: BoardIssue[]
  members: Map<string, BoardMember>
  subtaskCounts: Map<string, number>
}

// A column is a drop target, and its cards are sortable inside it.
export function BoardColumn({ status, issues, members, subtaskCounts }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status.id}`, data: { statusId: status.id } })

  return (
    <section
      aria-label={`${status.name}, ${issues.length} issues`}
      className="flex w-[280px] shrink-0 flex-col gap-2 rounded-md bg-surface-hover p-2"
    >
      <header className="flex items-center gap-2 px-1 py-1 text-xs font-medium text-text-primary">
        <span className={`size-2 rounded-full ${DOT[status.category]}`} aria-hidden="true" />
        <span>{status.name}</span>
        <span className="ml-auto text-text-secondary tabular-nums">{issues.length}</span>
      </header>

      <div
        ref={setNodeRef}
        className={[
          'flex min-h-24 flex-col gap-2 rounded-md transition-colors',
          isOver ? 'bg-surface-selected outline-dashed outline-1 outline-primary' : '',
        ].join(' ')}
      >
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              assignee={issue.assignee_id ? members.get(issue.assignee_id) : undefined}
              subtasks={subtaskCounts.get(issue.id) ?? 0}
            />
          ))}
        </SortableContext>
        {issues.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-text-secondary">No issues in {status.name.toLowerCase()}</p>
        )}
      </div>
    </section>
  )
}
