import { LoadingRegion, SkeletonBlock } from '../../components/Skeleton'

// Table rows only, used under the list table while its issues load.
export function ListRowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <LoadingRegion label="Loading issues" className="flex flex-col">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 border-border border-b px-4 py-3 last:border-b-0">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3.5 flex-1" />
          <SkeletonBlock className="h-5 w-20 rounded-full" />
          <SkeletonBlock className="size-6 rounded-full" />
        </div>
      ))}
    </LoadingRegion>
  )
}

// Placeholder for the list view while the project loads: filter bar, then table rows.
export function ListSkeleton() {
  return (
    <LoadingRegion label="Loading the list" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-8 w-28" />
        <SkeletonBlock className="h-8 w-28" />
        <SkeletonBlock className="h-8 w-28" />
      </div>
      <div className="flex flex-col rounded-md border border-border bg-surface-raised">
        <div className="flex items-center gap-4 border-border border-b px-4 py-3">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-3 flex-1" />
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
        <ListRowsSkeleton />
      </div>
    </LoadingRegion>
  )
}
