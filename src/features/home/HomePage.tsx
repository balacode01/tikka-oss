import { useQuery } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router'
import { supabase } from '../../lib/supabase'

type HomeData = {
  assigned: { id: string; key: string; title: string; due_date: string | null; status: string }[]
  due_this_week: { id: string; key: string; title: string; due_date: string }[]
  projects: { id: string; key: string; name: string; active_sprint: { name: string; done: number; total: number } | null }[]
  recently_viewed: { id: string; key: string; title: string }[]
}

// Your work: issues assigned to you, your projects and recently viewed issues.
export function HomePage() {
  const workspaces = useQuery({
    queryKey: ['my-workspaces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, slug')
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const workspace = workspaces.data?.[0]

  const home = useQuery({
    queryKey: ['home', workspace?.id],
    enabled: Boolean(workspace),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('home', { p_workspace: workspace!.id })
      if (error) throw error
      return data as unknown as HomeData
    },
  })

  if (workspaces.isPending) return <p className="text-sm text-text-secondary">Loading your work</p>
  if (!workspace) return <Navigate to="/onboarding" replace />

  const hasActivity = home.data && (home.data.assigned.length > 0 || home.data.projects.length > 0)

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Your work</h1>
        <p className="text-sm text-text-secondary">{workspace.name}</p>
      </div>

      {!home.isPending && !hasActivity && (
        <section className="flex flex-col gap-3 rounded-md border border-border bg-surface-raised p-6">
          <h2 className="font-medium text-base">Get started</h2>
          <p className="text-sm text-text-secondary">Create an issue in a project to see it here.</p>
          {home.data?.projects[0] && (
            <Link
              to={`/w/${workspace.slug}/p/${home.data.projects[0].key}/board`}
              className="self-start rounded-sm border border-border-strong bg-surface-raised px-3 py-1.5 text-sm font-medium hover:bg-surface-hover"
            >
              Open {home.data.projects[0].name}
            </Link>
          )}
        </section>
      )}

      {home.data && home.data.assigned.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium text-base">Assigned to you</h2>
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface-raised">
            {home.data.assigned.map((issue) => (
              <li key={issue.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-mono text-xs text-text-secondary">{issue.key}</span>
                <span className="min-w-0 flex-1 truncate" title={issue.title}>{issue.title}</span>
                <span className="text-xs text-text-secondary">{issue.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {home.data && home.data.projects.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium text-base">Your projects</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {home.data.projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/w/${workspace.slug}/p/${p.key}/board`}
                  className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-3 hover:bg-surface-hover"
                >
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className="font-mono text-xs text-text-secondary">{p.key}</span>
                  {p.active_sprint && (
                    <span className="text-xs text-text-secondary tabular-nums">
                      {p.active_sprint.name}: {p.active_sprint.done} of {p.active_sprint.total} done
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
