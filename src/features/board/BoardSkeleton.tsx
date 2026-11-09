import { LoadingRegion, SkeletonBlock } from '../../components/Skeleton'

// Placeholder for the board while its issues load: sprint header and four status columns.
export function BoardSkeleton() {
  return (
    <LoadingRegion label="Loading the board" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 border-border border-b pb-4">
        <SkeletonBlock className="h-5 w-56" />
        <SkeletonBlock className="h-3 w-80" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[3, 4, 2, 1].map((cards, column) => (
          <div key={column} className="flex w-[280px] shrink-0 flex-col gap-3 rounded-md bg-surface-hover p-3">
            <SkeletonBlock className="h-4 w-24" />
            {Array.from({ length: cards }, (_, card) => (
              <div key={card} className="flex flex-col gap-2 rounded-md border border-border bg-surface-raised p-3">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-3.5 w-full" />
                <SkeletonBlock className="h-3.5 w-3/4" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}
