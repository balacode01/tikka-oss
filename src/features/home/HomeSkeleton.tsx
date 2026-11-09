import { LoadingRegion, SkeletonBlock } from '../../components/Skeleton'

// Placeholder for Your work while its data loads. Mirrors the real layout: assigned rows, project cards,
// recently viewed, and the due-this-week and activity column.
export function HomeSkeleton() {
  return (
    <LoadingRegion label="Loading your work" className="flex flex-col">
      <header className="-mx-6 -mt-6 flex items-baseline gap-3 border-border border-b bg-surface-selected px-6 py-4">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-3.5 w-48" />
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3">
            <SkeletonBlock className="h-4 w-36" />
            <div className="flex items-center gap-6 border-border border-b pb-2">
              <SkeletonBlock className="h-3.5 w-20" />
              <SkeletonBlock className="h-3.5 w-28" />
            </div>
            <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface-raised px-4">
              {Array.from({ length: 6 }, (_, row) => (
                <div key={row} className="flex items-center gap-3 py-3">
                  <SkeletonBlock className="size-4" />
                  <SkeletonBlock className="h-3 w-16" />
                  <SkeletonBlock className="h-3.5 flex-1" />
                  <SkeletonBlock className="hidden h-3 w-28 sm:block" />
                  <SkeletonBlock className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SkeletonBlock className="h-4 w-32" />
            <div className="grid gap-3 lg:grid-cols-3">
              {[0, 1, 2].map((card) => (
                <div key={card} className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4">
                  <div className="flex items-center gap-3">
                    <SkeletonBlock className="size-8" />
                    <div className="flex flex-1 flex-col gap-2">
                      <SkeletonBlock className="h-3.5 w-2/3" />
                      <SkeletonBlock className="h-3 w-1/3" />
                    </div>
                  </div>
                  <SkeletonBlock className="h-3.5 w-5/6" />
                  <SkeletonBlock className="h-3.5 w-3/5" />
                  <SkeletonBlock className="h-1.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SkeletonBlock className="h-4 w-36" />
            <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface-raised px-4">
              {Array.from({ length: 4 }, (_, row) => (
                <div key={row} className="flex items-center gap-3 py-3">
                  <SkeletonBlock className="h-3 w-16" />
                  <SkeletonBlock className="h-3.5 flex-1" />
                  <SkeletonBlock className="hidden h-3 w-32 sm:block" />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-4">
            <SkeletonBlock className="h-4 w-32" />
            {Array.from({ length: 3 }, (_, row) => (
              <div key={row} className="flex flex-col gap-2 py-1">
                <SkeletonBlock className="h-3 w-24" />
                <SkeletonBlock className="h-3.5 w-full" />
              </div>
            ))}
          </section>
          <section className="flex flex-col gap-4 rounded-md border border-border bg-surface-raised p-4">
            <SkeletonBlock className="h-4 w-20" />
            {Array.from({ length: 4 }, (_, row) => (
              <div key={row} className="flex gap-3">
                <SkeletonBlock className="size-7 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <SkeletonBlock className="h-3.5 w-11/12" />
                  <SkeletonBlock className="h-3 w-16" />
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </LoadingRegion>
  )
}
