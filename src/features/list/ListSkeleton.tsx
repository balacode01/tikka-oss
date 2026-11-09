import { LoadingRegion, SkeletonBlock } from '../../components/Skeleton'

// One placeholder per table column. Widths match the header cells in ListPage.tsx, so the rows line up
// with real rows when they arrive.
const CELLS = [
  { width: 'w-10', block: 'size-4' },
  { width: 'w-8', block: 'size-4' },
  { width: 'w-28', block: 'h-3 w-16' },
  { width: '', block: 'h-3.5 w-3/4' },
  { width: 'w-40', block: 'h-5 w-24 rounded-full' },
  { width: 'w-44', block: 'size-6 rounded-full' },
  { width: 'w-28', block: 'h-3 w-16' },
  { width: 'w-20', block: 'ml-auto h-3 w-10' },
  { width: 'w-36', block: 'h-3 w-20' },
  { width: 'w-40', block: 'h-3 w-24' },
  { width: 'w-32', block: 'h-3 w-20' },
]

// Table rows only, to be placed inside a tbody. Used while issues load, and while more load under the table.
export function ListRowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="border-border border-b" aria-hidden="true">
          {CELLS.map((cell, index) => (
            <td key={index} className={`px-3 py-3 ${cell.width}`}>
              <SkeletonBlock className={cell.block} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// Placeholder for the list view while the project loads: filter bar, then a table with its headers and rows.
export function ListSkeleton() {
  return (
    <LoadingRegion label="Loading the list" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-8 w-28" />
        <SkeletonBlock className="h-8 w-28" />
        <SkeletonBlock className="h-8 w-28" />
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-surface-raised">
        <table className="w-full min-w-[1100px] border-collapse text-sm" aria-hidden="true">
          <thead className="bg-surface-page">
            <tr className="border-border border-b">
              {CELLS.map((cell, index) => (
                <th key={index} className={`px-3 py-2 ${cell.width}`}>
                  <SkeletonBlock className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <ListRowsSkeleton />
          </tbody>
        </table>
      </div>
    </LoadingRegion>
  )
}
