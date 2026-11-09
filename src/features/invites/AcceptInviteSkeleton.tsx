import { LoadingRegion, SkeletonBlock } from '../../components/Skeleton'

// Placeholder for the invite page while the invite details load: a centred card with a title and lines.
export function AcceptInviteSkeleton() {
  return (
    <LoadingRegion label="Loading the invite" className="mx-auto flex w-full max-w-md flex-col gap-4 p-8">
      <SkeletonBlock className="h-6 w-3/4" />
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-3.5 w-full" />
        <SkeletonBlock className="h-3.5 w-5/6" />
      </div>
      <SkeletonBlock className="mt-2 h-8 w-full" />
    </LoadingRegion>
  )
}
