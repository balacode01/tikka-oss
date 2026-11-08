import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import type { BoardMember, BoardStatus } from './useBoard'
import type { useIssueExtras } from './useIssueExtras'

type Extras = ReturnType<typeof useIssueExtras>

type Props = {
  issueId: string
  canEdit: boolean
  statuses: BoardStatus[]
  members: BoardMember[]
  extras: Extras
  currentUserId: string | undefined
}

const LINK_LABEL = { blocks: 'Blocks', relates_to: 'Relates to' } as const

// Sub-tasks and linked issues. Adding either needs edit access, like the rest of the issue.
export function RelationsSection({ canEdit, statuses, members, extras, currentUserId }: Props) {
  const [subtitle, setSubtitle] = useState('')
  const [linkKey, setLinkKey] = useState('')
  const [linkType, setLinkType] = useState<'blocks' | 'relates_to'>('relates_to')

  const statusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? ''
  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? 'Member' : 'Unassigned')
  const todo = statuses.find((s) => s.category === 'todo')?.id ?? null
  const subtasks = extras.subtasks.data ?? []
  const links = extras.links.data ?? []

  function addSubtask(event: FormEvent) {
    event.preventDefault()
    const title = subtitle.trim()
    if (!title) return
    extras.addSubtask.mutate(
      { title, status: todo },
      {
        onSuccess: () => setSubtitle(''),
        onError: (error) => toast(error.message),
      },
    )
  }

  function addLink(event: FormEvent) {
    event.preventDefault()
    if (!currentUserId || !linkKey.trim()) return
    extras.addLink.mutate(
      { targetKey: linkKey, type: linkType, authorId: currentUserId },
      {
        onSuccess: () => setLinkKey(''),
        onError: (error) => toast(error.message),
      },
    )
  }

  return (
    <section className="flex flex-col gap-6 border-border border-t pt-6">
      <div className="flex flex-col gap-3">
        <h3 className="font-medium text-sm text-text-primary">
          Sub-tasks <span className="text-text-secondary tabular-nums">{subtasks.length}</span>
        </h3>
        {subtasks.length === 0 && <p className="text-sm text-text-secondary">No sub-tasks yet.</p>}
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {subtasks.map((sub) => (
            <li key={sub.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-mono text-xs text-text-secondary">{sub.key}</span>
              <span className="min-w-0 flex-1 truncate">{sub.title}</span>
              <span className="text-xs text-text-secondary">{statusName(sub.status_id)}</span>
              <span className="w-24 truncate text-right text-xs text-text-secondary">{memberName(sub.assignee_id)}</span>
            </li>
          ))}
        </ul>
        {canEdit && (
          <form onSubmit={addSubtask} className="flex gap-2">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Add sub-task"
              aria-label="Sub-task title"
              maxLength={255}
              className="h-8 flex-1 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary placeholder:text-text-secondary"
            />
            <Button type="submit" disabled={extras.addSubtask.isPending}>
              <Plus />
              Add sub-task
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-medium text-sm text-text-primary">
          Linked issues <span className="text-text-secondary tabular-nums">{links.length}</span>
        </h3>
        {links.length === 0 && <p className="text-sm text-text-secondary">No linked issues.</p>}
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {links.map((link) => (
            <li key={link.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="text-xs text-text-secondary">
                {LINK_LABEL[link.link_type]}
                {link.direction === 'incoming' && link.link_type === 'blocks' ? ' (blocked by)' : ''}
              </span>
              <span className="font-mono text-xs text-text-secondary">{link.key}</span>
              <span className="min-w-0 flex-1 truncate">{link.title}</span>
            </li>
          ))}
        </ul>
        {canEdit && (
          <form onSubmit={addLink} className="flex items-center gap-2">
            <Select value={linkType} onChange={(e) => setLinkType(e.target.value as 'blocks' | 'relates_to')} className="w-36">
              <option value="relates_to">Relates to</option>
              <option value="blocks">Blocks</option>
            </Select>
            <input
              value={linkKey}
              onChange={(e) => setLinkKey(e.target.value)}
              placeholder="Issue key, such as MOB-146"
              aria-label="Issue key to link"
              className="h-8 flex-1 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary placeholder:text-text-secondary"
            />
            <Button type="submit" disabled={extras.addLink.isPending}>Link issue</Button>
          </form>
        )}
      </div>
    </section>
  )
}
