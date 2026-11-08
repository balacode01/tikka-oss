import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement>

// Native select with the browser arrow removed and a chevron centred in the right edge.
export function Select({ className = '', children, ...rest }: Props) {
  return (
    <div className="relative w-full">
      <select
        className={[
          'h-8 w-full appearance-none rounded-sm border border-border-strong bg-surface-raised py-0 pr-9 pl-3 text-sm font-normal text-text-primary',
          className,
        ].join(' ')}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-secondary"
      />
    </div>
  )
}
