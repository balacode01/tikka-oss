import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import type { BoardMember, BoardStatus, ProjectOption } from './useBoard'
import type { useIssueExtras } from './useIssueExtras'

type Props = {
  issueId: string
  currentUserId: string | undefined
  members: BoardMember[]
  statuses: BoardStatus[]
  sprints: ProjectOption[]
  extras: ReturnType<typeof useIssueExtras>
}

const FIELD_NAMES: Record<string, string> = {
  status_id: 'status',
  assignee_id: 'assignee',
  priority: 'priority',
  sprint_id: 'sprint',
  title: 'title',
  due_date: 'due date',
  story_points: 'story points',
  epic_id: 'epic',
  parent_id: 'parent',
  type: 'type',
  deleted_at: 'deleted',
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

// "3 hours ago", "Yesterday", or a date for anything older.
function relativeTime(iso: string, now = new Date()) {
  const diffMs = now.getTime() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

// Activity tabs: comments (anyone who can see the issue can add one) and history.
export function ActivitySection({ currentUserId, members, statuses, sprints, extras }: Props) {
  const [tab, setTab] = useState<'comments' | 'history'>('comments')
  const [body, setBody] = useState('')

  const nameOf = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? 'Member' : 'Someone')
  const comments = extras.comments.data ?? []
  const history = extras.history.data ?? []

  // History stores ids for status, assignee and sprint. Show their names.
  function valueFor(field: string, value: string | null) {
    if (value === null || value === '') return 'none'
    if (field === 'status_id') return statuses.find((s) => s.id === value)?.name ?? value
    if (field === 'assignee_id') return nameOf(value)
    if (field === 'sprint_id') return sprints.find((s) => s.id === value)?.title ?? value
    return value
  }

  function postComment(event: FormEvent) {
    event.preventDefault()
    const text = body.trim()
    if (!text || !currentUserId) return
    extras.addComment.mutate(
      { body: text, authorId: currentUserId },
      {
        onSuccess: () => setBody(''),
        onError: (error) => toast(error.message),
      },
    )
  }

  return (
    <section className="flex flex-col gap-4 border-border border-t pt-6">
      <div role="tablist" aria-label="Activity" className="flex gap-4 border-border border-b">
        {(['comments', 'history'] as const).map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === name}
            type="button"
            onClick={() => setTab(name)}
            className={[
              '-mb-px cursor-pointer border-b-2 pb-2 text-sm font-medium',
              tab === name ? 'border-primary text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary',
            ].join(' ')}
          >
            {name === 'comments' ? `Comments ${comments.length}` : 'History'}
          </button>
        ))}
      </div>

      {tab === 'comments' && (
        <div className="flex flex-col gap-4">
          {comments.length === 0 && <p className="text-sm text-text-secondary">No comments yet.</p>}
          {comments.map((c) => (
            <article key={c.id} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-selected text-xs font-medium text-primary-subtle-text">
                {initials(nameOf(c.author_id))}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm">
                  <span className="font-medium">{nameOf(c.author_id)}</span>
                  <span className="ml-2 text-xs text-text-secondary">{relativeTime(c.created_at)}</span>
                  {c.edited_at && <span className="ml-1 text-xs text-text-secondary">(edited)</span>}
                </p>
                <p className="whitespace-pre-wrap text-sm text-text-primary">{c.body}</p>
              </div>
            </article>
          ))}

          {currentUserId && (
            <form onSubmit={postComment} className="flex flex-col gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Add a comment"
                aria-label="Add a comment"
                className="rounded-sm border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!body.trim() || extras.addComment.isPending}>Comment</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === 'history' && (
        <ul className="flex flex-col gap-3">
          {history.length === 0 && <li className="text-sm text-text-secondary">No changes yet.</li>}
          {history.map((h) => (
            <li key={h.id} className="text-sm">
              <span className="font-medium">{nameOf(h.actor_id)}</span>{' '}
              changed the {FIELD_NAMES[h.field] ?? h.field} from{' '}
              <span className="text-text-secondary">{valueFor(h.field, h.old_value)}</span> to{' '}
              <span className="text-text-primary">{valueFor(h.field, h.new_value)}</span>
              <span className="ml-2 text-xs text-text-secondary">{relativeTime(h.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
