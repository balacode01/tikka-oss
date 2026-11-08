import { Dialog } from '@base-ui/react/dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { supabase } from '../../lib/supabase'
import type { BoardMember } from './useBoard'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  workspaceSlug: string
  projectKey: string
  members: BoardMember[]
  todoStatusId?: string
}

const TYPES = ['task', 'story', 'bug', 'epic'] as const
const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const

// Create issue (BRD §7.1, key C). The server picks the To do status and the next key.
export function CreateIssueDialog({ open, onOpenChange, projectId, workspaceSlug, projectKey, members, todoStatusId }: Props) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<(typeof TYPES)[number]>('task')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('medium')
  const [assignee, setAssignee] = useState('')
  const [points, setPoints] = useState('')
  const [another, setAnother] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)

  const titleError = submitted && title.trim().length === 0 ? 'Give the issue a title' : undefined

  function reset() {
    setTitle('')
    setPoints('')
    setSubmitted(false)
    setServerError('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (title.trim().length === 0) return

    setPending(true)
    const { data, error } = await supabase.rpc('create_issue', {
      p_project: projectId,
      p_type: type,
      p_title: title.trim(),
      p_description: null,
      p_status: todoStatusId ?? null,
      p_priority: priority,
      p_assignee: assignee || null,
      p_sprint: null,
      p_epic: null,
      p_parent: null,
      p_points: points === '' ? null : Number(points),
      p_due: null,
      p_labels: null,
    })
    setPending(false)

    if (error) {
      setServerError(error.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['board', workspaceSlug, projectKey] })
    toast(`Issue created: ${data.key}`)
    if (another) {
      reset()
    } else {
      reset()
      onOpenChange(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6 text-text-primary shadow-modal">
          <Dialog.Title className="font-semibold text-xl">Create issue</Dialog.Title>

          <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Type
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
                  className="h-8 rounded-sm border border-border-strong bg-surface-raised px-2 text-sm font-normal"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Priority
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as (typeof PRIORITIES)[number])}
                  className="h-8 rounded-sm border border-border-strong bg-surface-raised px-2 text-sm font-normal"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
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

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Assignee
                <select
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="h-8 rounded-sm border border-border-strong bg-surface-raised px-2 text-sm font-normal"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
              <Field
                id="ci-points"
                label="Story points"
                type="number"
                min={0}
                step="0.5"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>

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
                  {pending ? 'Creating issue' : 'Create issue'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
