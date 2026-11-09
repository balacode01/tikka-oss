import { LoadingRegion, SkeletonBlock } from '../../components/Skeleton'

// Placeholder for the backlog while sprints and issues load: two sprint sections, then backlog rows.
export function BacklogSkeleton() {
  return (
    <LoadingRegion label="Loading the backlog" className="flex flex-col gap-6">
      {[3, 2].map((rows, section) => (
        <section key={section} className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-4">
          <div className="flex items-center justify-between gap-4 pb-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-7 w-28" />
          </div>
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className="flex items-center gap-3 border-border border-t py-2.5">
              <SkeletonBlock className="size-4" />
              <SkeletonBlock className="h-3 w-16" />
              <SkeletonBlock className="h-3.5 flex-1" />
              <SkeletonBlock className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </section>
      ))}
    </LoadingRegion>
  )
}
