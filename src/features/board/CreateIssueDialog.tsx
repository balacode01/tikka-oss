import { Dialog } from '@base-ui/react/dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { supabase } from '../../lib/supabase'
import type { BoardMember, BoardStatus, ProjectOption } from './useBoard'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  workspaceSlug: string
  projectKey: string
  currentUserId: string | undefined
  members: BoardMember[]
  statuses: BoardStatus[]
  sprints: ProjectOption[]
  epics: ProjectOption[]
  todoStatusId?: string
}

// Types as shown in the design. Sub-tasks are added from a parent issue's panel.
const TYPES = [
  { value: 'story', label: 'Story' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'epic', label: 'Epic' },
] as const
type IssueType = (typeof TYPES)[number]['value']

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
type Priority = (typeof PRIORITIES)[number]

const labelClass = 'flex flex-col gap-1.5 text-sm font-medium text-text-primary'
const inputClass = 'h-8 w-full rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal text-text-primary placeholder:text-text-secondary'

// Create issue (BRD §7.1, key C). Layout follows the "Create issue" artboard: 640px modal,
// type as buttons, a required title, and "Assign to me" under the assignee.
export function CreateIssueDialog({
  open,
  onOpenChange,
  projectId,
  workspaceSlug,
  projectKey,
  currentUserId,
  members,
  statuses,
  sprints,
  epics,
  todoStatusId,
}: Props) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<IssueType>('task')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [sprint, setSprint] = useState('')
  const [epic, setEpic] = useState('')
  const [assignee, setAssignee] = useState('')
  const [points, setPoints] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [labels, setLabels] = useState('')
  const [another, setAnother] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)

  const titleError = submitted && title.trim().length === 0 ? 'Enter a title' : undefined
  const pointsError = submitted && points !== '' && Number(points) < 0 ? 'Points cannot be negative' : undefined

  function reset() {
    setTitle('')
    setDescription('')
    setPoints('')
    setDueDate('')
    setLabels('')
    setSubmitted(false)
    setServerError('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (titleError || pointsError) return

    setPending(true)
    const { data, error } = await supabase.rpc('create_issue', {
      p_project: projectId,
      p_type: type,
      p_title: title.trim(),
      p_description: description.trim() === '' ? null : description.trim(),
      p_status: status || todoStatusId || null,
      p_priority: priority,
      p_assignee: assignee || null,
      p_sprint: sprint || null,
      p_epic: type === 'epic' || epic === '' ? null : epic,
      p_parent: null,
      p_points: points === '' ? null : Number(points),
      p_due: dueDate || null,
      p_labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
    })
    setPending(false)

    if (error) {
      setServerError(error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['board', workspaceSlug, projectKey] })
    toast(`Issue created: ${data.key}`)
    reset()
    if (!another) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-lg border border-border bg-surface-raised p-6 text-text-primary shadow-modal">
          <Dialog.Title className="font-semibold text-xl">Create</Dialog.Title>

          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Issue type</span>
              <div role="radiogroup" aria-label="Issue type" className="inline-flex w-fit gap-1 rounded-sm border border-border-strong p-0.5">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={type === t.value}
                    onClick={() => setType(t.value)}
                    className={[
                      'h-7 cursor-pointer rounded-sm px-3 text-sm',
                      type === t.value ? 'bg-surface-selected font-medium text-primary-subtle-text' : 'text-text-secondary hover:bg-surface-hover',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <label className={labelClass}>
              <span className="flex items-center gap-2">
                Title
                <span className="text-xs font-normal text-text-secondary">Required</span>
              </span>
              <input
                id="ci-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to happen?"
                maxLength={255}
                aria-invalid={titleError ? true : undefined}
                className={`${inputClass} ${titleError ? 'border-danger' : ''}`}
              />
              {titleError && <span className="text-xs font-normal text-danger-text">{titleError}</span>}
            </label>

            <label className={labelClass}>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Add context, steps or links"
                className="rounded-sm border border-border-strong bg-surface-raised px-3 py-2 text-sm font-normal text-text-primary placeholder:text-text-secondary"
              />
            </label>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <label className={labelClass}>
                Status
                <Select value={status || todoStatusId || ''} onChange={(e) => setStatus(e.target.value)}>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </label>
              <label className={labelClass}>
                Priority
                <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                  ))}
                </Select>
              </label>

              <div className={labelClass}>
                <label htmlFor="ci-assignee">Assignee</label>
                <Select id="ci-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
                {currentUserId && (
                  <button
                    type="button"
                    onClick={() => setAssignee(currentUserId)}
                    className="self-start text-xs font-medium text-primary hover:text-primary-hover"
                  >
                    Assign to me
                  </button>
                )}
              </div>
              <label className={labelClass}>
                Sprint
                <Select value={sprint} onChange={(e) => setSprint(e.target.value)}>
                  <option value="">Backlog</option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}{s.state === 'active' ? ' (active)' : ''}</option>
                  ))}
                </Select>
              </label>

              <label className={labelClass}>
                Epic
                <Select value={epic} onChange={(e) => setEpic(e.target.value)} disabled={type === 'epic'}>
                  <option value="">No epic</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>{e.key} {e.title}</option>
                  ))}
                </Select>
              </label>
              <label className={labelClass}>
                Story points
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  aria-invalid={pointsError ? true : undefined}
                  className={`${inputClass} ${pointsError ? 'border-danger' : ''}`}
                />
                {pointsError && <span className="text-xs font-normal text-danger-text">{pointsError}</span>}
              </label>

              <label className={labelClass}>
                Due date
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
              </label>
              <label className={labelClass}>
                Labels
                <input
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                  placeholder="frontend, auth"
                  className={inputClass}
                />
                <span className="text-xs font-normal text-text-secondary">Separate labels with commas</span>
              </label>
            </div>

            {serverError && (
              <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>
            )}

            <div className="flex items-center justify-between gap-3 border-border border-t pt-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={another}
                  onChange={(e) => setAnother(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Create another
              </label>
              <div className="flex gap-2">
                <Dialog.Close render={<Button />}>Cancel</Dialog.Close>
                <Button variant="primary" type="submit" disabled={pending}>
                  {pending ? 'Creating' : 'Create'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
