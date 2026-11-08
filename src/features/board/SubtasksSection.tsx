import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import type { BoardMember, BoardStatus } from './useBoard'
import type { useIssueExtras } from './useIssueExtras'
import { StatusPill } from './StatusPill'

type Props = {
  issueId: string
  projectId: string
  canEdit: boolean
  statuses: BoardStatus[]
  members: BoardMember[]
  extras: ReturnType<typeof useIssueExtras>
}

// Sub-tasks with a progress bar and checkboxes. Ticking a box moves the sub-task to Done or To do.
export function SubtasksSection({ issueId, canEdit, statuses, members, extras }: Props) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const subtasks = extras.subtasks.data ?? []
  const doneIds = new Set(statuses.filter((s) => s.category === 'done').map((s) => s.id))
  const done = subtasks.filter((s) => doneIds.has(s.status_id)).length
  const todoStatus = statuses.find((s) => s.category === 'todo')
  const doneStatus = statuses.find((s) => s.category === 'done')

  const toggle = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const target = checked ? doneStatus?.id : todoStatus?.id
      if (!target) throw new Error('This project has no status to move the sub-task to.')
      const { error } = await supabase.rpc('move_issue', { p_issue: id, p_status: target, p_before: null, p_after: null })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', issueId] })
      queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (error) => toast(error.message),
  })

  function addSubtask(event: FormEvent) {
    event.preventDefault()
    const text = title.trim()
    if (!text) return
    extras.addSubtask.mutate(
      { title: text, status: todoStatus?.id ?? null },
      { onSuccess: () => setTitle(''), onError: (error) => toast(error.message) },
    )
  }

  const percent = subtasks.length === 0 ? 0 : Math.round((done / subtasks.length) * 100)

  return (
    <section className="flex flex-col gap-3 border-border border-t pt-6">
      <div className="flex items-center gap-3">
        <h3 className="font-medium text-sm text-text-primary">Sub-tasks</h3>
        <span className="text-[13px] text-text-secondary tabular-nums">{done} of {subtasks.length} done</span>
        {subtasks.length > 0 && (
          <div className="ml-auto h-1.5 w-32 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <div className="h-full rounded-full bg-status-done" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>

      {subtasks.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {subtasks.map((sub) => {
            const checked = doneIds.has(sub.status_id)
            const assignee = members.find((m) => m.id === sub.assignee_id)
            return (
              <li key={sub.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!canEdit}
                  onChange={(e) => toggle.mutate({ id: sub.id, checked: e.target.checked })}
                  aria-label={`Mark ${sub.key} done`}
                  className="size-4 accent-primary"
                />
                <span className="font-mono text-xs text-text-secondary">{sub.key}</span>
                <span className={`min-w-0 flex-1 truncate ${checked ? 'text-text-secondary line-through' : ''}`}>{sub.title}</span>
                {statuses.find((s) => s.id === sub.status_id) && (
                  <StatusPill status={statuses.find((s) => s.id === sub.status_id)!} />
                )}
                <span
                  title={assignee?.name ?? 'Unassigned'}
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-selected text-[10px] font-medium text-primary-subtle-text"
                >
                  {assignee ? assignee.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={addSubtask} className="flex items-center gap-2">
          <Plus className="size-4 text-primary" aria-hidden="true" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add sub-task"
            aria-label="Sub-task title"
            maxLength={255}
            className="h-8 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary"
          />
          <Button type="submit" disabled={!title.trim() || extras.addSubtask.isPending}>Add</Button>
        </form>
      )}
    </section>
  )
}
