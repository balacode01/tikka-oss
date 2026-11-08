import { Popover } from '@base-ui/react/popover'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { DayPicker, type CustomComponents } from 'react-day-picker'
import { fromIsoDate, toIsoDate } from './dateUtils'

type Props = {
  id?: string
  value: string // yyyy-mm-dd, or '' when empty
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
}

function formatDisplay(value: string) {
  const date = fromIsoDate(value)
  if (!date) return ''
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Calendar icons and chevrons use the design's icon set (Lucide), in text-secondary.
const Chevron: CustomComponents['Chevron'] = ({ orientation }) =>
  orientation === 'left'
    ? <ChevronLeft className="size-4" aria-hidden="true" />
    : <ChevronRight className="size-4" aria-hidden="true" />

// Date input: a field that opens a calendar popover. Choosing a day closes it. Clear and Today are included.
export function DatePicker({ id, value, onChange, placeholder = 'Pick a date', disabled, ...rest }: Props) {
  const [open, setOpen] = useState(false)
  const selected = fromIsoDate(value)

  function choose(date: Date | undefined) {
    onChange(date ? toIsoDate(date) : '')
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id}
        disabled={disabled}
        aria-label={rest['aria-label']}
        className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-sm border border-border-strong bg-surface-raised px-3 text-left text-sm font-normal text-text-primary disabled:cursor-not-allowed disabled:text-text-secondary"
      >
        <CalendarDays className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
        <span className={value ? '' : 'text-text-secondary'}>{value ? formatDisplay(value) : placeholder}</span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner sideOffset={6} className="z-[60]">
          <Popover.Popup className="relative flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-3 text-text-primary shadow-popover">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={choose}
              defaultMonth={selected ?? new Date()}
              showOutsideDays
              components={{ Chevron }}
              classNames={{
                root: 'text-sm',
                months: 'flex flex-col',
                month: 'flex flex-col gap-2',
                month_caption: 'flex h-8 items-center justify-center font-medium',
                nav: 'absolute top-3 right-3 flex gap-1',
                button_previous: 'grid size-7 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover',
                button_next: 'grid size-7 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover',
                month_grid: 'border-collapse',
                weekdays: 'text-[12px] text-text-secondary',
                weekday: 'w-9 pb-1 text-center font-normal',
                week: '',
                day: 'p-0 text-center',
                day_button: 'size-9 cursor-pointer rounded-sm text-sm hover:bg-surface-hover',
                selected: '[&>button]:bg-primary [&>button]:text-on-primary [&>button]:hover:bg-primary-hover',
                today: '[&>button]:font-semibold [&>button]:underline',
                outside: 'text-text-secondary opacity-60',
                disabled: 'opacity-40',
              }}
            />
            <div className="flex items-center justify-between border-border border-t pt-2 text-sm">
              <button type="button" onClick={() => choose(undefined)} className="cursor-pointer rounded-sm px-2 py-1 text-text-secondary hover:bg-surface-hover">
                Clear
              </button>
              <button type="button" onClick={() => choose(new Date())} className="cursor-pointer rounded-sm px-2 py-1 font-medium text-primary hover:bg-surface-hover">
                Today
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
