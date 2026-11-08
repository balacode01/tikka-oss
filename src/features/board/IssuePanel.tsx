import { Dialog } from '@base-ui/react/dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Share2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { supabase } from '../../lib/supabase'
import { ActivitySection } from './ActivitySection'
import { RelationsSection } from './RelationsSection'
import type { BoardMember, BoardStatus, ProjectOption } from './useBoard'
import { useIssueDetail, type IssueRow } from './useIssueDetail'
import { useIssueExtras } from './useIssueExtras'

type Props = {
  issueId: string | null
  onClose: () => void
  workspaceSlug: string
  projectKey: string
  projectId: string
  currentUserId: string | undefined
  statuses: BoardStatus[]
  members: BoardMember[]
  sprints: ProjectOption[]
  epics: ProjectOption[]
}

const TYPES = ['task', 'story', 'bug', 'epic'] as const
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const label = 'text-sm font-medium text-text-secondary'
const inputClass = 'h-8 w-full rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal text-text-primary disabled:text-text-secondary'

// Side panel (560px, from the right), following the "Issue side panel" artboard.
// Only the assignee can edit fields, sub-tasks and links. Anyone who can see the issue can comment.
export function IssuePanel(props: Props) {
  const detail = useIssueDetail(props.issueId)

  return (
    <Dialog.Root open={props.issueId !== null} onOpenChange={(open) => { if (!open) props.onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20" />
        <Dialog.Popup className="fixed top-0 right-0 z-50 flex h-full w-[560px] max-w-full flex-col overflow-y-auto border-border border-l bg-surface-raised text-text-primary">
          {detail.data ? (
            <IssueForm key={`${detail.data.id}-${detail.data.updated_at}`} issue={detail.data} {...props} />
          ) : (
            <p className="p-6 text-sm text-text-secondary">Loading the issue</p>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type FormProps = Props & { issue: IssueRow }

function IssueForm({ issue, onClose, workspaceSlug, projectKey, projectId, currentUserId, statuses, members, sprints, epics }: FormProps) {
  const queryClient = useQueryClient()
  const canEdit = currentUserId !== undefined && issue.assignee_id === currentUserId
  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? 'Member' : 'Unassigned')
  const extras = useIssueExtras(issue.id, projectId)
  const watching = currentUserId !== undefined && (extras.watchers.data ?? []).includes(currentUserId)

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
  const [newLabel, setNewLabel] = useState('')

  const labels = useQuery({
    queryKey: ['labels', issue.id],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('issue_labels').select('label').eq('issue_id', issue.id).order('label')
      if (error) throw error
      return (data ?? []).map((l) => l.label)
    },
  })

  const addLabel = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('issue_labels').insert({ issue_id: issue.id, label: text })
      if (error) throw error
    },
    onSuccess: () => {
      setNewLabel('')
      queryClient.invalidateQueries({ queryKey: ['labels', issue.id] })
    },
    onError: (error) => toast(error.message),
  })

  const removeLabel = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('issue_labels').delete().eq('issue_id', issue.id).eq('label', text)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['labels', issue.id] }),
    onError: (error) => toast(error.message),
  })

  const titleError = submitted && title.trim().length === 0 ? 'Enter a title' : undefined

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) return
    setSubmitted(true)
    setServerError('')
    if (title.trim().length === 0) return

    setPending(true)
    // A status change goes through move_issue, so the issue gets a rank in its new column.
    if (status !== issue.status_id) {
      const { error } = await supabase.rpc('move_issue', { p_issue: issue.id, p_status: status, p_before: null, p_after: null })
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

  function share() {
    navigator.clipboard.writeText(`${window.location.origin}/w/${workspaceSlug}/p/${projectKey}/board?issue=${issue.key}`)
    toast('Link copied')
  }

  const disabled = !canEdit

  return (
    <form noValidate onSubmit={save} className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => currentUserId && extras.toggleWatch.mutate({ userId: currentUserId, watching })}
            aria-pressed={watching}
            className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-sm text-text-secondary hover:bg-surface-hover"
          >
            {watching ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            {watching ? 'Watching' : 'Watch'}
          </button>
          <button type="button" onClick={share} className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-sm text-text-secondary hover:bg-surface-hover">
            <Share2 className="size-4" aria-hidden="true" />
            Share
          </button>
          <button
            type="button"
            aria-label="Close issue"
            onClick={onClose}
            className="grid size-8 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </span>
      </header>
      <Dialog.Title className="sr-only">{issue.key} {issue.title}</Dialog.Title>

      {disabled && (
        <p className="rounded-sm bg-surface-hover p-2 text-sm text-text-secondary">
          Only the assignee, {memberName(issue.assignee_id)}, can edit this issue.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <input
          id="ip-title"
          aria-label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          maxLength={255}
          aria-invalid={titleError ? true : undefined}
          className="w-full bg-transparent font-semibold text-2xl tracking-[-0.015em] text-text-primary outline-none disabled:text-text-primary"
        />
        {titleError && <span className="text-xs text-danger-text">{titleError}</span>}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Status</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={disabled}>
            {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Assignee</span>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={disabled}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          {!disabled && currentUserId && assignee !== currentUserId && (
            <button type="button" onClick={() => setAssignee(currentUserId)} className="self-start text-xs font-medium text-primary hover:text-primary-hover">
              Assign to me
            </button>
          )}
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Reporter</span>
          <span className="flex h-8 items-center text-sm text-text-primary">{memberName(issue.reporter_id)}</span>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Priority</span>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as IssueRow['priority'])} disabled={disabled}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Sprint</span>
          <Select value={sprint} onChange={(e) => setSprint(e.target.value)} disabled={disabled}>
            <option value="">Backlog</option>
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.title}{s.state === 'active' ? ' (active)' : ''}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Epic</span>
          <Select value={epic} onChange={(e) => setEpic(e.target.value)} disabled={disabled || type === 'epic'}>
            <option value="">No epic</option>
            {epics.map((e) => <option key={e.id} value={e.id}>{e.key} {e.title}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Story points</span>
          <input type="number" min={0} step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} disabled={disabled} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Due date</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={disabled} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Type</span>
          <Select value={type} onChange={(e) => setType(e.target.value as IssueRow['type'])} disabled={disabled || issue.type === 'subtask'}>
            {issue.type === 'subtask' && <option value="subtask">Sub-task</option>}
            {TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Labels</span>
        <div className="flex flex-wrap items-center gap-2">
          {(labels.data ?? []).map((text) => (
            <span key={text} className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-0.5 text-xs text-text-primary">
              {text}
              {canEdit && (
                <button type="button" aria-label={`Remove label ${text}`} onClick={() => removeLabel.mutate(text)} className="cursor-pointer text-text-secondary hover:text-text-primary">
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
            </span>
          ))}
          {canEdit && (
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                const text = newLabel.trim()
                if (text) addLabel.mutate(text)
              }}
              placeholder="Add label"
              aria-label="Add label"
              className="h-7 w-28 rounded-sm border border-border-strong bg-surface-raised px-2 text-xs text-text-primary placeholder:text-text-secondary"
            />
          )}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={label}>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
          rows={5}
          className="rounded-sm border border-border-strong bg-surface-raised px-3 py-2 text-sm font-normal text-text-primary disabled:text-text-secondary"
        />
      </label>

      {serverError && <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>}

      {canEdit && (
        <div className="flex justify-end">
          <Button variant="primary" type="submit" disabled={pending}>{pending ? 'Saving' : 'Save'}</Button>
        </div>
      )}

      <RelationsSection
        issueId={issue.id}
        canEdit={canEdit}
        statuses={statuses}
        members={members}
        extras={extras}
        currentUserId={currentUserId}
      />

      <ActivitySection
        issueId={issue.id}
        currentUserId={currentUserId}
        members={members}
        statuses={statuses}
        sprints={sprints}
        extras={extras}
      />
    </form>
  )
}
