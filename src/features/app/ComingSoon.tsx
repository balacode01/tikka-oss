// Placeholder for screens that come in later milestones (BRD §8).
export function ComingSoon({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-semibold text-xl">{title}</h1>
      <p className="text-sm text-text-secondary">This screen arrives in {milestone}.</p>
    </div>
  )
}
