import { Dialog } from '@base-ui/react/dialog'
import { useQueryClient } from '@tanstack/react-query'
import { Bold, Bookmark, Bug, Check, ChevronDown, Code, Italic, List, Upload, Zap, SquareCheck, type LucideIcon } from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { DatePicker } from '../../components/DatePicker'
import { Select } from '../../components/Select'
import { supabase } from '../../lib/supabase'
import { MAX_ATTACHMENT_BYTES, uploadAttachment } from './attachments'
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
  defaultStatusId?: string
  // Optional project picker, used when the dialog is opened from outside a board (top bar).
  projects?: { key: string; name: string }[]
  onProjectChange?: (key: string) => void
}

// Issue types with the icon, colour and description from the "Create issue" artboard.
const TYPES: { value: 'epic' | 'story' | 'task' | 'bug'; label: string; description: string; icon: LucideIcon; color: string }[] = [
  { value: 'epic', label: 'Epic', description: 'A large body of work that groups stories and tasks.', icon: Zap, color: 'text-type-epic' },
  { value: 'story', label: 'Story', description: 'A feature or change described from a user’s point of view.', icon: Bookmark, color: 'text-type-story' },
  { value: 'task', label: 'Task', description: 'A piece of work the team needs to get done.', icon: SquareCheck, color: 'text-type-task' },
  { value: 'bug', label: 'Bug', description: 'Something that isn’t working as it should.', icon: Bug, color: 'text-type-bug' },
]
type IssueType = (typeof TYPES)[number]['value']

const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const
type Priority = (typeof PRIORITIES)[number]

const labelClass = 'flex flex-col gap-1.5 text-sm font-medium text-text-primary'
const inputClass = 'h-8 w-full rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal text-text-primary placeholder:text-text-secondary'

// Create (BRD §7.1, key C). Layout follows the "Create issue" artboard: 640px modal, a type menu with
// descriptions, a required title, a description toolbar, assignee shortcut, attachments and a footer.
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
  defaultStatusId,
  projects,
  onProjectChange,
}: Props) {
  const queryClient = useQueryClient()
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<IssueType>('task')
  const [typeOpen, setTypeOpen] = useState(false)
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
  const [files, setFiles] = useState<File[]>([])
  const [another, setAnother] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)

  const titleError = submitted && title.trim().length === 0 ? 'Enter a title' : undefined
  const pointsError = submitted && points !== '' && Number(points) < 0 ? 'Points cannot be negative' : undefined
  const currentType = TYPES.find((t) => t.value === type) ?? TYPES[2]
  const CurrentIcon = currentType.icon

  function reset() {
    setTitle('')
    setDescription('')
    setPoints('')
    setDueDate('')
    setLabels('')
    setFiles([])
    setSubmitted(false)
    setServerError('')
  }

  // Wraps the selected description text in a markdown marker, or adds a list item.
  function format(before: string, after = before) {
    const el = descriptionRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = description.slice(start, end) || 'text'
    const next = description.slice(0, start) + before + selected + after + description.slice(end)
    setDescription(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const accepted: File[] = []
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_BYTES) toast(`${file.name} is larger than 25 MB`)
      else accepted.push(file)
    }
    setFiles((current) => [...current, ...accepted])
  }

  async function onSubmit(event?: FormEvent) {
    event?.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (titleError || pointsError) return

    setPending(true)
    const { data, error } = await supabase.rpc('create_issue', {
      p_project: projectId,
      p_type: type,
      p_title: title.trim(),
      p_description: description.trim() === '' ? null : description.trim(),
      p_status: status || defaultStatusId || todoStatusId || null,
      p_priority: priority,
      p_assignee: assignee || null,
      p_sprint: sprint || null,
      p_epic: type === 'epic' || epic === '' ? null : epic,
      p_parent: null,
      p_points: points === '' ? null : Number(points),
      p_due: dueDate || null,
      p_labels: labels.split(',').map((l) => l.trim()).filter(Boolean),
    })

    if (error) {
      setPending(false)
      setServerError(error.message)
      return
    }

    // Files are added after the issue exists, because they are stored under its id.
    if (files.length > 0 && currentUserId) {
      for (const file of files) {
        const failure = await uploadAttachment(data.id, file, currentUserId)
        if (failure) toast(failure)
      }
    }
    setPending(false)

    queryClient.invalidateQueries({ queryKey: ['board', workspaceSlug, projectKey] })
    toast(`Issue created: ${data.key}`)
    reset()
    if (!another) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface-raised text-text-primary shadow-modal">
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <Dialog.Title className="font-semibold text-xl">Create</Dialog.Title>
            <Dialog.Close aria-label="Close" className="grid size-8 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover">
              <span aria-hidden="true" className="text-lg leading-none">×</span>
            </Dialog.Close>
          </div>

          <form
            noValidate
            onSubmit={onSubmit}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onSubmit()
            }}
            className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 pb-2"
          >
            {projects && onProjectChange && (
              <label className={labelClass}>
                Project
                <Select value={projectKey} onChange={(e) => onProjectChange(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                </Select>
              </label>
            )}

            <div className={labelClass}>
              <span>Issue type</span>
              <div className="relative">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={typeOpen}
                  onClick={() => setTypeOpen((v) => !v)}
                  className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal text-text-primary"
                >
                  <CurrentIcon className={`size-4 ${currentType.color}`} aria-hidden="true" />
                  {currentType.label}
                  <ChevronDown className="ml-auto size-4 text-text-secondary" aria-hidden="true" />
                </button>
                {typeOpen && (
                  <ul role="listbox" aria-label="Issue type" className="absolute top-10 left-0 z-10 flex w-full flex-col gap-0.5 rounded-md border border-border bg-surface-raised p-1 shadow-popover">
                    {TYPES.map((t) => {
                      const Icon = t.icon
                      const selected = t.value === type
                      return (
                        <li key={t.value} role="option" aria-selected={selected}>
                          <button
                            type="button"
                            onClick={() => { setType(t.value); setTypeOpen(false) }}
                            className={`flex w-full cursor-pointer items-start gap-3 rounded-sm px-3 py-2 text-left hover:bg-surface-hover ${selected ? 'bg-surface-selected' : ''}`}
                          >
                            <Icon className={`mt-0.5 size-4 shrink-0 ${t.color}`} aria-hidden="true" />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-sm font-medium">{t.label}</span>
                              <span className="text-[13px] leading-[18px] text-text-secondary">{t.description}</span>
                            </span>
                            {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>

            <label className={labelClass}>
              <span className="flex items-center gap-2">
                Title
                <span className="text-xs font-normal text-text-secondary">Required</span>
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                maxLength={255}
                aria-invalid={titleError ? true : undefined}
                className={`${inputClass} ${titleError ? 'border-danger' : 'focus-visible:border-primary'}`}
              />
              {titleError && <span className="text-xs font-normal text-danger-text">{titleError}</span>}
            </label>

            <div className={labelClass}>
              <span>Description</span>
              <div className="flex flex-col rounded-sm border border-border-strong bg-surface-raised">
                <div className="flex items-center gap-0.5 border-border border-b px-1.5 py-1">
                  <ToolbarButton label="Bold" onClick={() => format('**')}><Bold className="size-4" /></ToolbarButton>
                  <ToolbarButton label="Italic" onClick={() => format('*')}><Italic className="size-4" /></ToolbarButton>
                  <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
                  <ToolbarButton label="Bulleted list" onClick={() => format('- ', '')}><List className="size-4" /></ToolbarButton>
                  <ToolbarButton label="Code" onClick={() => format('`')}><Code className="size-4" /></ToolbarButton>
                </div>
                <textarea
                  ref={descriptionRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Describe the work, the acceptance criteria and anything people need to know"
                  className="resize-y bg-transparent px-3 py-2 text-sm font-normal text-text-primary placeholder:text-text-secondary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div className={labelClass}>
                <label htmlFor="ci-assignee">Assignee</label>
                <Select id="ci-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
                {currentUserId && assignee !== currentUserId && (
                  <button type="button" onClick={() => setAssignee(currentUserId)} className="self-end text-xs font-medium text-primary hover:text-primary-hover">
                    Assign to me
                  </button>
                )}
              </div>
              <label className={labelClass}>
                Priority
                <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
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
              <label className={labelClass}>
                Epic
                <Select value={epic} onChange={(e) => setEpic(e.target.value)} disabled={type === 'epic'}>
                  <option value="">None</option>
                  {epics.map((e) => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </Select>
              </label>
              <label className={labelClass}>
                Status
                <Select value={status || defaultStatusId || todoStatusId || ''} onChange={(e) => setStatus(e.target.value)}>
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
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
                <DatePicker value={dueDate} onChange={setDueDate} aria-label="Due date" />
              </label>
              <label className={labelClass}>
                Labels
                <input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="frontend, auth" className={inputClass} />
              </label>
            </div>

            <div className={labelClass}>
              <span>Attachments</span>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
                className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border-strong px-4 py-5 text-center text-sm text-text-secondary"
              >
                <Upload className="size-5 text-text-secondary" aria-hidden="true" />
                <span>
                  Drop files here or{' '}
                  <button type="button" onClick={() => fileInput.current?.click()} className="font-medium text-primary hover:text-primary-hover">browse</button>
                </span>
                <span className="text-xs">Up to 25 MB each</span>
                <input ref={fileInput} type="file" multiple className="sr-only" aria-label="Choose files" onChange={(e) => addFiles(e.target.files)} />
              </div>
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2 pt-1">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong px-2 py-1 text-[13px] font-normal">
                      {f.name}
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((c) => c.filter((_, j) => j !== i))} className="text-text-secondary hover:text-text-primary">×</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {serverError && (
              <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>
            )}
          </form>

          <div className="flex items-center gap-3 border-border border-t px-6 py-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={another} onChange={(e) => setAnother(e.target.checked)} className="size-4 accent-primary" />
              Create another
            </label>
            <span className="ml-auto hidden text-xs text-text-secondary sm:inline">Ctrl Enter to create</span>
            <Dialog.Close render={<Button />}>Cancel</Dialog.Close>
            <Button variant="primary" type="button" onClick={() => onSubmit()} disabled={pending}>
              {pending ? 'Creating' : 'Create'}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-7 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary"
    >
      {children}
    </button>
  )
}
