import { Dialog } from '@base-ui/react/dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Bug, ChevronDown, Eye, EyeOff, Share2, SquareCheck, X, Zap, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { DatePicker } from '../../components/DatePicker'
import { Select } from '../../components/Select'
import { supabase } from '../../lib/supabase'
import { ActivitySection } from './ActivitySection'
import { AttachmentsSection } from './AttachmentsSection'
import { LinksSection } from './LinksSection'
import { StatusPill } from './StatusPill'
import { SubtasksSection } from './SubtasksSection'
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

const TYPE_ICON: Record<IssueRow['type'], { icon: LucideIcon; color: string }> = {
  epic: { icon: Zap, color: 'text-type-epic' },
  story: { icon: Bookmark, color: 'text-type-story' },
  task: { icon: SquareCheck, color: 'text-type-task' },
  bug: { icon: Bug, color: 'text-type-bug' },
  subtask: { icon: SquareCheck, color: 'text-type-subtask' },
}

const TYPES = ['task', 'story', 'bug', 'epic'] as const
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
const fieldLabel = 'text-[13px] leading-[18px] text-text-secondary'
const inputClass = 'h-8 w-full rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal text-text-primary disabled:text-text-secondary'

// Side panel (560px, from the right), following the "Issue side panel" artboard. Sections in the
// design's order: header, title, details, description, attachments, sub-tasks, linked issues, activity.
// Only the assignee can edit. Everyone who can see the issue can comment and watch it.
export function IssuePanel(props: Props) {
  const detail = useIssueDetail(props.issueId)

  return (
    <Dialog.Root open={props.issueId !== null} onOpenChange={(open) => { if (!open) props.onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20" />
        <Dialog.Popup className="fixed top-0 right-0 z-50 flex h-full w-[560px] max-w-full flex-col overflow-hidden border-border border-l bg-surface-raised text-text-primary">
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
  const extras = useIssueExtras(issue.id, projectId)
  const watching = currentUserId !== undefined && (extras.watchers.data ?? []).includes(currentUserId)
  const watcherCount = (extras.watchers.data ?? []).length
  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? 'Member' : 'Unassigned')

  const [title, setTitle] = useState(issue.title)
  const [description, setDescription] = useState(issue.description ?? '')
  const [type, setType] = useState(issue.type)
  const [priority, setPriority] = useState(issue.priority)
  const [assignee, setAssignee] = useState(issue.assignee_id ?? '')
  const [sprint, setSprint] = useState(issue.sprint_id ?? '')
  const [epic, setEpic] = useState(issue.epic_id ?? '')
  const [points, setPoints] = useState(issue.story_points === null ? '' : String(issue.story_points))
  const [dueDate, setDueDate] = useState(issue.due_date ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  // Opening an issue counts as a view. record_view keeps the newest 20 per user.
  useEffect(() => {
    supabase.rpc('record_view', { p_issue: issue.id }).then(({ error }) => {
      if (!error) queryClient.invalidateQueries({ queryKey: ['recent-issues'] })
    })
  }, [issue.id, queryClient])

  const labels = useQuery({
    queryKey: ['labels', issue.id],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('issue_labels').select('label').eq('issue_id', issue.id).order('label')
      if (error) throw error
      return (data ?? []).map((l) => l.label)
    },
  })

  const labelChange = useMutation({
    mutationFn: async ({ text, add }: { text: string; add: boolean }) => {
      if (add) {
        const { error } = await supabase.from('issue_labels').insert({ issue_id: issue.id, label: text })
        if (error) throw error
      } else {
        const { error } = await supabase.from('issue_labels').delete().eq('issue_id', issue.id).eq('label', text)
        if (error) throw error
      }
    },
    onSuccess: () => {
      setNewLabel('')
      queryClient.invalidateQueries({ queryKey: ['labels', issue.id] })
    },
    onError: (error) => toast(error.message),
  })

  // Status is changed from the header menu. It goes through move_issue, so the card lands in its column.
  const moveStatus = useMutation({
    mutationFn: async (statusId: string) => {
      const { error } = await supabase.rpc('move_issue', { p_issue: issue.id, p_status: statusId, p_before: null, p_after: null })
      if (error) throw error
    },
    onSuccess: () => {
      setMenuOpen(false)
      queryClient.invalidateQueries({ queryKey: ['board', workspaceSlug, projectKey] })
      queryClient.invalidateQueries({ queryKey: ['issue', issue.id] })
    },
    onError: (error) => toast(error.message),
  })

  const titleError = submitted && title.trim().length === 0 ? 'Enter a title' : undefined
  const currentStatus = statuses.find((s) => s.id === issue.status_id)

  async function save() {
    if (!canEdit) return
    setSubmitted(true)
    setServerError('')
    if (title.trim().length === 0) return

    setPending(true)
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
  const TypeIcon = TYPE_ICON[issue.type].icon

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      <header className="flex items-center gap-2">
        <TypeIcon className={`size-4 shrink-0 ${TYPE_ICON[issue.type].color}`} aria-hidden="true" />
        <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
        <button
          type="button"
          aria-label="Close issue"
          onClick={onClose}
          className="ml-auto grid size-8 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>
      <Dialog.Title className="sr-only">{issue.key} {issue.title}</Dialog.Title>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          {currentStatus && (
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => (canEdit ? setMenuOpen((v) => !v) : undefined)}
              className={`flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface-raised px-2 ${canEdit ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
            >
              <StatusPill status={currentStatus} />
              {canEdit && <ChevronDown className="size-4 text-text-secondary" aria-hidden="true" />}
            </button>
          )}
          {menuOpen && (
            <div role="menu" aria-label="Move to" className="absolute top-10 left-0 z-10 flex w-48 flex-col gap-0.5 rounded-md border border-border bg-surface-raised p-1 shadow-popover">
              <p className="px-2 py-1 text-[13px] text-text-secondary">Move to</p>
              {statuses.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitem"
                  onClick={() => moveStatus.mutate(s.id)}
                  className="flex items-center rounded-sm px-2 py-1.5 text-left hover:bg-surface-hover"
                >
                  <StatusPill status={s} />
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => currentUserId && extras.toggleWatch.mutate({ userId: currentUserId, watching })}
          aria-pressed={watching}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary hover:bg-surface-hover"
        >
          {watching ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          Watch
          <span className="text-text-secondary tabular-nums">{watcherCount}</span>
        </button>
        <button
          type="button"
          onClick={share}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary hover:bg-surface-hover"
        >
          <Share2 className="size-4" aria-hidden="true" />
          Share
        </button>
      </div>

      {disabled && (
        <p className="rounded-sm bg-surface-hover p-2 text-sm text-text-secondary">
          Only the assignee, {memberName(issue.assignee_id)}, can edit this issue.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <input
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

      <section className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-md border border-border p-4">
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Assignee</span>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={disabled}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Reporter</span>
          <span className="flex h-8 items-center text-sm">{memberName(issue.reporter_id)}</span>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Priority</span>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as IssueRow['priority'])} disabled={disabled}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Sprint</span>
          <Select value={sprint} onChange={(e) => setSprint(e.target.value)} disabled={disabled}>
            <option value="">Backlog</option>
            {sprints.map((s) => <option key={s.id} value={s.id}>{s.title}{s.state === 'active' ? ' (active)' : ''}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Epic</span>
          <Select value={epic} onChange={(e) => setEpic(e.target.value)} disabled={disabled || type === 'epic'}>
            <option value="">None</option>
            {epics.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Type</span>
          <Select value={type} onChange={(e) => setType(e.target.value as IssueRow['type'])} disabled={disabled || issue.type === 'subtask'}>
            {issue.type === 'subtask' && <option value="subtask">Sub-task</option>}
            {TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Story points</span>
          <input type="number" min={0} step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} disabled={disabled} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Due date</span>
          <DatePicker value={dueDate} onChange={setDueDate} disabled={disabled} aria-label="Due date" />
        </label>
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className={fieldLabel}>Labels</span>
          <div className="flex flex-wrap items-center gap-2">
            {(labels.data ?? []).map((text) => (
              <span key={text} className="inline-flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-0.5 text-xs text-text-primary">
                {text}
                {canEdit && (
                  <button type="button" aria-label={`Remove label ${text}`} onClick={() => labelChange.mutate({ text, add: false })} className="cursor-pointer text-text-secondary hover:text-text-primary">
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
                  if (text) labelChange.mutate({ text, add: true })
                }}
                placeholder="Add label"
                aria-label="Add label"
                className="h-7 w-28 rounded-sm border border-border-strong bg-surface-raised px-2 text-xs text-text-primary placeholder:text-text-secondary"
              />
            )}
          </div>
        </div>
      </section>

      <label className="flex flex-col gap-2">
        <span className="font-medium text-sm">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
          rows={6}
          className="rounded-sm border border-border-strong bg-surface-raised px-3 py-2 text-[15px] leading-6 font-normal text-text-primary disabled:text-text-secondary"
        />
      </label>

      {serverError && <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>}

      <AttachmentsSection issueId={issue.id} canEdit={canEdit} currentUserId={currentUserId} />

      <SubtasksSection issueId={issue.id} projectId={projectId} canEdit={canEdit} statuses={statuses} members={members} extras={extras} />

      <LinksSection canEdit={canEdit} statuses={statuses} extras={extras} currentUserId={currentUserId} />

      <ActivitySection issueId={issue.id} currentUserId={currentUserId} members={members} statuses={statuses} sprints={sprints} extras={extras} />
      </div>

      {canEdit && (
        <div className="flex shrink-0 justify-end border-border border-t bg-surface-raised px-6 py-3">
          <Button variant="primary" type="button" onClick={save} disabled={pending}>{pending ? 'Saving' : 'Save'}</Button>
        </div>
      )}
    </div>
  )
}
