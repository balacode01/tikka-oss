import { Bookmark, Bug, CornerDownRight, Link as LinkIcon, SquareCheck, Zap, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import type { BoardStatus } from './useBoard'
import type { LinkedIssue, useIssueExtras } from './useIssueExtras'
import { StatusPill } from './StatusPill'

type Props = {
  canEdit: boolean
  statuses: BoardStatus[]
  extras: ReturnType<typeof useIssueExtras>
  currentUserId: string | undefined
}

const TYPE_ICON: Record<LinkedIssue['type'], { icon: LucideIcon; color: string }> = {
  epic: { icon: Zap, color: 'text-type-epic' },
  story: { icon: Bookmark, color: 'text-type-story' },
  task: { icon: SquareCheck, color: 'text-type-task' },
  bug: { icon: Bug, color: 'text-type-bug' },
  subtask: { icon: CornerDownRight, color: 'text-type-subtask' },
}

const GROUP_LABEL: Record<LinkedIssue['link_type'], string> = { blocks: 'Blocks', relates_to: 'Relates to' }

// Linked issues grouped by relation, as in the design. Adding a link needs edit access.
export function LinksSection({ canEdit, statuses, extras, currentUserId }: Props) {
  const [adding, setAdding] = useState(false)
  const [key, setKey] = useState('')
  const [type, setType] = useState<LinkedIssue['link_type']>('relates_to')
  const links = extras.links.data ?? []

  function addLink(event: FormEvent) {
    event.preventDefault()
    if (!currentUserId || !key.trim()) return
    extras.addLink.mutate(
      { targetKey: key, type, authorId: currentUserId },
      {
        onSuccess: () => { setKey(''); setAdding(false) },
        onError: (error) => toast(error.message),
      },
    )
  }

  const groups: LinkedIssue['link_type'][] = ['blocks', 'relates_to']

  return (
    <section className="flex flex-col gap-3 border-border border-t pt-6">
      <h3 className="font-medium text-sm text-text-primary">Linked issues</h3>

      {links.length === 0 && <p className="text-sm text-text-secondary">No linked issues.</p>}

      {groups.map((group) => {
        const items = links.filter((l) => l.link_type === group)
        if (items.length === 0) return null
        return (
          <div key={group} className="flex flex-col gap-2">
            <p className="text-[13px] text-text-secondary">{GROUP_LABEL[group]}</p>
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {items.map((link) => {
                const Icon = TYPE_ICON[link.type].icon
                const status = statuses.find((s) => s.id === link.status_id)
                return (
                  <li key={link.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Icon className={`size-4 shrink-0 ${TYPE_ICON[link.type].color}`} aria-hidden="true" />
                    <span className="font-mono text-xs text-text-secondary">{link.key}</span>
                    <span className="min-w-0 flex-1 truncate">{link.title}</span>
                    {status && <StatusPill status={status} />}
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      {canEdit && !adding && (
        <button type="button" onClick={() => setAdding(true)} className="flex w-fit cursor-pointer items-center gap-1.5 text-[13px] font-medium text-primary hover:text-primary-hover">
          <LinkIcon className="size-4" aria-hidden="true" />
          Link issue
        </button>
      )}

      {canEdit && adding && (
        <form onSubmit={addLink} className="flex items-center gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value as LinkedIssue['link_type'])} wrapperClassName="w-36">
            <option value="relates_to">Relates to</option>
            <option value="blocks">Blocks</option>
          </Select>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Issue key, such as MOB-146"
            aria-label="Issue key to link"
            className="h-8 flex-1 rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary placeholder:text-text-secondary"
          />
          <Button type="submit" disabled={extras.addLink.isPending}>Link</Button>
        </form>
      )}
    </section>
  )
}
