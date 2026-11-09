import { LoadingRegion, SkeletonBlock } from '../../components/Skeleton'

// Placeholder for profile settings while the profile row loads: title, tabs, avatar and form fields.
export function ProfileSkeleton() {
  return (
    <LoadingRegion label="Loading your profile" className="flex w-full max-w-[720px] flex-col gap-8">
      <SkeletonBlock className="h-7 w-44" />
      <div className="flex gap-6 border-border border-b pb-2.5">
        <SkeletonBlock className="h-3.5 w-16" />
        <SkeletonBlock className="h-3.5 w-20" />
        <SkeletonBlock className="h-3.5 w-24" />
        <SkeletonBlock className="h-3.5 w-16" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <SkeletonBlock className="size-20 rounded-full" />
          <SkeletonBlock className="h-8 w-32" />
        </div>
        {[0, 1, 2].map((field) => (
          <div key={field} className="flex flex-col gap-1.5">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-8 w-full" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}
