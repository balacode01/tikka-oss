import { LoadingRegion, SkeletonBlock } from '../../components/Skeleton'

// Placeholder for Create project while the workspace loads: breadcrumb, title and form card.
export function CreateProjectSkeleton() {
  return (
    <LoadingRegion label="Loading" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-3 w-40" />
        <SkeletonBlock className="h-6 w-44" />
      </div>
      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-6">
        {[0, 1].map((field) => (
          <div key={field} className="flex flex-col gap-1.5">
            <SkeletonBlock className="h-3 w-28" />
            <SkeletonBlock className="h-8 w-full" />
          </div>
        ))}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SkeletonBlock className="h-20 rounded-md" />
          <SkeletonBlock className="h-20 rounded-md" />
        </div>
      </div>
    </LoadingRegion>
  )
}
