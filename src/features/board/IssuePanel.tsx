import { Dialog } from '@base-ui/react/dialog'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { Select } from '../../components/Select'
import { supabase } from '../../lib/supabase'
import type { BoardMember, BoardStatus, ProjectOption } from './useBoard'
import { useIssueDetail, type IssueRow } from './useIssueDetail'

type Props = {
  issueId: string | null
  onClose: () => void
  workspaceSlug: string
  projectKey: string
  currentUserId: string | undefined
  statuses: BoardStatus[]
  members: BoardMember[]
  sprints: ProjectOption[]
  epics: ProjectOption[]
}

const TYPES = ['task', 'story', 'bug', 'epic'] as const
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const labelClass = 'flex flex-col gap-1.5 text-sm font-medium'

// Side panel opened from a card (BRD §7.1: 560px, from the right).
// Only the assignee can edit the issue. Everyone else sees it read-only.
export function IssuePanel(props: Props) {
  const detail = useIssueDetail(props.issueId)

  return (
    <Dialog.Root open={props.issueId !== null} onOpenChange={(open) => { if (!open) props.onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20" />
        <Dialog.Popup className="fixed top-0 right-0 z-50 flex h-full w-[560px] max-w-full flex-col overflow-y-auto border-border border-l bg-surface-raised text-text-primary shadow-modal">
          {detail.data ? (
            <IssueForm
              key={`${detail.data.id}-${detail.data.updated_at}`}
              issue={detail.data}
              {...props}
            />
          ) : (
            <p className="p-6 text-sm text-text-secondary">Loading the issue</p>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type FormProps = Props & { issue: IssueRow }

// The form starts from the saved issue. The parent remounts it when the issue changes.
function IssueForm({ issue, workspaceSlug, projectKey, currentUserId, statuses, members, sprints, epics }: FormProps) {
  const queryClient = useQueryClient()
  const canEdit = currentUserId !== undefined && issue.assignee_id === currentUserId
  const assigneeName = members.find((m) => m.id === issue.assignee_id)?.name

  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description ?? '')
  const [type, setType] = useState(issue.type)
  const [status, setStatus] = useState(issue.status_id)
  const [priority, setPriority] = useState(issue.priority)
  const [assignee, setAssignee] = useState(issue.assignee_id ?? '')
  const [sprint, setSprint] = useState(issue.sprint_id ?? '')
  const [epic, setEpic] = useState(issue.epic_id ?? '')
  const [points, setPoints] = useState(issue.story_points === null ? '' : String(issue.story_points))
  const [dueDate, setDueDate] = useState(issue.due_date ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)

  const titleError = submitted && title.trim().length === 0 ? 'Give the issue a title' : undefined

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setSubmitted(true)
    setServerError('')
    if (title.trim().length === 0) return

    setPending(true)
    // A status change goes through move_issue, so the issue gets a rank in its new column.
    if (status !== issue.status_id) {
      const { error } = await supabase.rpc('move_issue', {
        p_issue: issue.id,
        p_status: status,
        p_before: null,
        p_after: null,
      })
      if (error) {
        setPending(false)
        setServerError(error.message)
        return
      }
    }

    const { error } = await supabase
      .from('issues')
      .update({
        type,
        title: title.trim(),
        description: description.trim() === '' ? null : description.trim(),
        priority,
        assignee_id: assignee || null,
        sprint_id: sprint || null,
        epic_id: type === 'epic' || epic === '' ? null : epic,
        story_points: points === '' ? null : Number(points),
        due_date: dueDate || null,
      })
      .eq('id', issue.id)
    setPending(false)

    if (error) {
      setServerError(error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['board', workspaceSlug, projectKey] })
    queryClient.invalidateQueries({ queryKey: ['issue', issue.id] })
    toast('Changes saved')
  }

  const disabled = !canEdit

  return (
    <form noValidate onSubmit={save} className="flex flex-1 flex-col gap-5 p-6">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-mono text-xs text-text-secondary">{issue.key}</p>
          <Dialog.Title className="sr-only">{issue.key} {issue.title}</Dialog.Title>
        </div>
        <Dialog.Close
          aria-label="Close issue"
          className="grid size-8 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover"
        >
          <X className="size-4" aria-hidden="true" />
        </Dialog.Close>
      </div>

      {disabled && (
        <p className="rounded-sm bg-surface-hover p-2 text-sm text-text-secondary">
          Only the assignee{assigneeName ? `, ${assigneeName},` : ''} can edit this issue.
        </p>
      )}

      <Field
        id="ip-title"
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={titleError}
        disabled={disabled}
        maxLength={255}
        className="text-base font-semibold"
      />

      <label className={labelClass}>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
          rows={5}
          className="rounded-sm border border-border-strong bg-surface-raised px-3 py-2 text-sm font-normal text-text-primary disabled:text-text-secondary"
        />
      </label>

      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        <label className={labelClass}>
          Status
          <Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={disabled}>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </label>
        <label className={labelClass}>
          Type
          <Select value={type} onChange={(e) => setType(e.target.value as IssueRow['type'])} disabled={disabled || issue.type === 'subtask'}>
            {issue.type === 'subtask' && <option value="subtask">Sub-task</option>}
            {TYPES.map((t) => (
              <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
            ))}
          </Select>
        </label>
        <label className={labelClass}>
          Priority
          <Select value={priority} onChange={(e) => setPriority(e.target.value as IssueRow['priority'])} disabled={disabled}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
            ))}
          </Select>
        </label>
        <label className={labelClass}>
          Assignee
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={disabled}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </label>
        <label className={labelClass}>
          Sprint
          <Select value={sprint} onChange={(e) => setSprint(e.target.value)} disabled={disabled}>
            <option value="">Backlog</option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>{s.title}{s.state === 'active' ? ' (active)' : ''}</option>
            ))}
          </Select>
        </label>
        <label className={labelClass}>
          Epic
          <Select value={epic} onChange={(e) => setEpic(e.target.value)} disabled={disabled || type === 'epic'}>
            <option value="">No epic</option>
            {epics.map((e) => (
              <option key={e.id} value={e.id}>{e.key} {e.title}</option>
            ))}
          </Select>
        </label>
        <Field
          id="ip-points"
          label="Story points"
          type="number"
          min={0}
          step="0.5"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          disabled={disabled}
        />
        <Field
          id="ip-due"
          label="Due date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={disabled}
        />
      </div>

      {serverError && (
        <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>
      )}

      {canEdit && (
        <div className="mt-auto flex justify-end gap-2 pt-2">
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? 'Saving' : 'Save'}
          </Button>
        </div>
      )}
    </form>
  )
}
