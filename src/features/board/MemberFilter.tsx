import { Popover } from '@base-ui/react/popover'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { useState } from 'react'
import type { BoardMember } from './useBoard'

const VISIBLE = 3
const PAGE_SIZE = 8

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

type Props = {
  members: BoardMember[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

// Member filter for the board. The first few avatars are shown, and "+N" opens a scrollable,
// paginated list of everyone else. Choosing a member filters the board to that person's issues.
export function MemberFilter({ members, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const shown = members.slice(0, VISIBLE)
  const overflow = members.length - VISIBLE
  const pages = Math.max(1, Math.ceil(members.length / PAGE_SIZE))
  const pageMembers = members.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex items-center -space-x-1.5 pl-2">
      {shown.map((m) => {
        const selected = selectedId === m.id
        return (
          <button
            key={m.id}
            type="button"
            title={m.name}
            aria-label={`Show issues for ${m.name}`}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : m.id)}
            className={`grid size-7 cursor-pointer place-items-center rounded-full border-2 text-[10px] font-medium text-primary-subtle-text ${selected ? 'border-primary bg-surface-selected' : 'border-surface-page bg-surface-selected'}`}
          >
            {initials(m.name)}
          </button>
        )
      })}

      {overflow > 0 && (
        <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (next) setPage(0) }}>
          <Popover.Trigger
            aria-label={`${overflow} more members`}
            className="grid h-7 min-w-7 cursor-pointer place-items-center rounded-full border-2 border-surface-page bg-surface-hover px-1.5 text-[10px] font-medium text-text-primary"
          >
            +{overflow}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={6} className="z-[60]">
              <Popover.Popup className="relative flex w-64 flex-col gap-2 rounded-md border border-border bg-surface-raised p-2 text-text-primary shadow-popover">
                <p className="px-2 pt-1 text-[13px] text-text-secondary">Members · {members.length}</p>
                <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                  {pageMembers.map((m) => {
                    const selected = selectedId === m.id
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => { onSelect(selected ? null : m.id); setOpen(false) }}
                          className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-hover"
                        >
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-selected text-[10px] font-medium text-primary-subtle-text">{initials(m.name)}</span>
                          <span className="min-w-0 flex-1 truncate">{m.name}</span>
                          {selected && <Check className="size-4 text-primary" aria-hidden="true" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {pages > 1 && (
                  <div className="flex items-center justify-between border-border border-t pt-2 text-[13px] text-text-secondary">
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="grid size-7 cursor-pointer place-items-center rounded-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                    </button>
                    <span className="tabular-nums">Page {page + 1} of {pages}</span>
                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={page >= pages - 1}
                      onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                      className="grid size-7 cursor-pointer place-items-center rounded-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  )
}
