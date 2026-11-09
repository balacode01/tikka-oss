import { Popover } from '@base-ui/react/popover'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

type Option = { value: string; label: string }

type Props = {
  label: string
  options: Option[]
  selected: string[]
  onChange: (values: string[]) => void
}

// One filter dropdown with checkboxes. The button shows how many values are chosen.
export function FilterMenu({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const active = selected.length > 0

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={`flex h-8 cursor-pointer items-center gap-2 rounded-sm border px-3 text-sm ${active ? 'border-primary bg-surface-selected text-primary-subtle-text' : 'border-border-strong bg-surface-raised text-text-primary hover:bg-surface-hover'}`}
      >
        {label}
        {active && <span className="rounded-full bg-primary px-1.5 text-[11px] font-medium text-on-primary tabular-nums">{selected.length}</span>}
        <ChevronDown className="size-4 text-text-secondary" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-[60]">
          <Popover.Popup className="flex w-56 flex-col gap-1 rounded-md border border-border bg-surface-raised p-2 text-text-primary shadow-popover">
            <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
              {options.map((o) => (
                <li key={o.value}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-hover">
                    <input
                      type="checkbox"
                      checked={selected.includes(o.value)}
                      onChange={() => toggle(o.value)}
                      className="size-4 accent-primary"
                    />
                    {o.label}
                  </label>
                </li>
              ))}
              {options.length === 0 && <li className="px-2 py-1.5 text-sm text-text-secondary">Nothing to choose</li>}
            </ul>
            {active && (
              <button type="button" onClick={() => onChange([])} className="mt-1 border-border border-t px-2 pt-2 text-left text-[13px] font-medium text-primary hover:text-primary-hover">
                Clear {label.toLowerCase()}
              </button>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
