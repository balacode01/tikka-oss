import type { ReactNode } from 'react'

type BlockProps = { className?: string }

// One shimmering block. Size and shape come from className (width, height, radius).
export function SkeletonBlock({ className = '' }: BlockProps) {
  return <span aria-hidden="true" className={`skeleton block rounded-sm ${className}`} />
}

// Several lines of text placeholder. The last line is shorter, like real text.
export function SkeletonLines({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={`skeleton block h-3 rounded-sm ${index === lines - 1 ? 'w-2/5' : 'w-full'}`} />
      ))}
    </div>
  )
}

// Wraps a skeleton so screen readers hear the loading message and skip the placeholder shapes.
export function LoadingRegion({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}
