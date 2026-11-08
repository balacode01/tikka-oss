import { Dialog } from '@base-ui/react/dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { Select } from '../../components/Select'
import { supabase } from '../../lib/supabase'
import type { BoardMember, BoardStatus, ProjectOption } from './useBoard'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  workspaceSlug: string
  projectKey: string
  members: BoardMember[]
  statuses: BoardStatus[]
  sprints: ProjectOption[]
  epics: ProjectOption[]
  parents: ProjectOption[]
  todoStatusId?: string
}

const TYPES = ['task', 'story', 'bug', 'epic', 'subtask'] as const
type IssueType = (typeof TYPES)[number]
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
type Priority = (typeof PRIORITIES)[number]

const labelClass = 'flex flex-col gap-1 text-sm font-medium'

// Create issue (BRD §7.1, key C). Optional details sit in the same form.
// The server picks the next key, and the To do status when none is chosen.
export function CreateIssueDialog({
  open,
  onOpenChange,
  projectId,
  workspaceSlug,
  projectKey,
  members,
  statuses,
  sprints,
  epics,
  parents,
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
  const [parent, setParent] = useState('')
  const [assignee, setAssignee] = useState('')
  const [points, setPoints] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [labels, setLabels] = useState('')
  const [another, setAnother] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)

  const titleError = submitted && title.trim().length === 0 ? 'Give the issue a title' : undefined
  const parentError = submitted && type === 'subtask' && parent === ''
    ? 'A sub-task needs a parent issue. Choose one above.'
    : undefined
  const pointsError = submitted && points !== '' && Number(points) < 0 ? 'Points cannot be negative' : undefined

  function reset() {
    setTitle('')
    setDescription('')
    setPoints('')
    setDueDate('')
    setLabels('')
    setParent('')
    setSubmitted(false)
    setServerError('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (titleError || parentError || pointsError) return

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
      p_parent: type === 'subtask' ? parent : null,
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
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(600px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface-raised p-6 text-text-primary shadow-modal">
          <Dialog.Title className="font-semibold text-xl">Create</Dialog.Title>

          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>
                Type
                <Select value={type} onChange={(e) => setType(e.target.value as IssueType)}>
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t === 'subtask' ? 'Sub-task' : t[0].toUpperCase() + t.slice(1)}</option>
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
            </div>

            <Field
              id="ci-title"
              label="Title"
              placeholder="What needs to happen?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={titleError}
              maxLength={255}
            />

            <label className={labelClass}>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Add context, steps or links. Markdown works."
                className="rounded-sm border border-border-strong bg-surface-raised px-3 py-2 text-sm font-normal text-text-primary placeholder:text-text-secondary"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>
                Status
                <Select value={status || todoStatusId || ''} onChange={(e) => setStatus(e.target.value)}>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </label>
              <label className={labelClass}>
                Sprint
                <Select value={sprint} onChange={(e) => setSprint(e.target.value)}>
                  <option value="">Backlog</option>
                  {sprints.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}{s.state === 'active' ? ' (active)' : ''}</option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                Assignee
                <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </label>
            </div>

            {type === 'subtask' && (
              <label className={labelClass}>
                Parent issue
                <Select
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                  aria-invalid={parentError ? true : undefined}
                  className={parentError ? 'border-danger' : ''}
                >
                  <option value="">Choose a parent</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>{p.key} {p.title}</option>
                  ))}
                </Select>
                {parentError && <span className="text-xs font-normal text-danger-text">{parentError}</span>}
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field
                id="ci-points"
                label="Story points"
                type="number"
                min={0}
                step="0.5"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                error={pointsError}
              />
              <Field
                id="ci-due"
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <Field
              id="ci-labels"
              label="Labels"
              placeholder="frontend, auth"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              hint="Separate labels with commas"
            />

            {serverError && (
              <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
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
