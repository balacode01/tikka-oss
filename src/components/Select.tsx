import { ChevronDown } from 'lucide-react'
import type { SelectHTMLAttributes } from 'react'

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string
}

// Native select with the browser arrow removed and a chevron centred vertically in the right edge.
// The chevron is positioned against the wrapper, so it stays centred at any height.
export function Select({ className = '', wrapperClassName = 'w-full', children, ...rest }: Props) {
  return (
    <div className={`relative flex ${wrapperClassName}`}>
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
