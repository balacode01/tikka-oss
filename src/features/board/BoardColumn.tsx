import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { IssueCard, type SubtaskProgress } from './IssueCard'
import type { BoardIssue, BoardMember, BoardStatus } from './useBoard'

// Status pill colours from the design tokens: the pill always carries the name, plus a dot.
const PILL: Record<BoardStatus['category'], { pill: string; dot: string }> = {
  todo: { pill: 'bg-status-todo-bg text-status-todo-text', dot: 'bg-status-todo' },
  in_progress: { pill: 'bg-status-progress-bg text-status-progress-text', dot: 'bg-status-progress' },
  done: { pill: 'bg-status-done-bg text-status-done-text', dot: 'bg-status-done' },
}

type Props = {
  status: BoardStatus
  issues: BoardIssue[]
  members: Map<string, BoardMember>
  subtasks: Map<string, SubtaskProgress>
  epicTitles: Map<string, string>
  onOpen: (issueId: string) => void
  onCreate: (statusId: string) => void
}

// A column is a drop target, and its cards are sortable inside it.
export function BoardColumn({ status, issues, members, subtasks, epicTitles, onOpen, onCreate }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status.id}`, data: { statusId: status.id } })
  const points = issues.reduce((sum, i) => sum + (i.story_points ?? 0), 0)
  const colors = PILL[status.category]

  return (
    <section
      aria-label={`${status.name}, ${issues.length} issues`}
      className="flex w-[280px] shrink-0 flex-col gap-2 rounded-md bg-surface-hover p-2"
    >
      <header className="flex items-center gap-2 px-1 py-1 text-[13px] leading-[18px]">
        <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ${colors.pill}`}>
          <span className={`size-2 rounded-full ${colors.dot}`} aria-hidden="true" />
          {status.name}
        </span>
        <span className="text-text-secondary tabular-nums">{issues.length}</span>
        <span className="ml-auto text-text-secondary tabular-nums">{points} pts</span>
        <button
          type="button"
          aria-label={`Create issue in ${status.name}`}
          onClick={() => onCreate(status.id)}
          className="grid size-6 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-raised"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
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
              subtasks={subtasks.get(issue.id) ?? { done: 0, total: 0 }}
              epicTitle={issue.epic_id ? epicTitles.get(issue.epic_id) : undefined}
              onOpen={onOpen}
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
