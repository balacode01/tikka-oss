import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type SprintRow = {
  id: string
  name: string
  goal: string | null
  state: 'planned' | 'active' | 'completed'
  start_date: string | null
  end_date: string | null
}

export type EpicProgress = { id: string; title: string; issue_count: number; done_count: number }

// Sprints that still matter on the backlog: planned and active, oldest first.
export function useBacklogSprints(projectId: string | undefined) {
  return useQuery({
    queryKey: ['backlog-sprints', projectId],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<SprintRow[]> => {
      const { data, error } = await supabase
        .from('sprints')
        .select('id, name, goal, state, start_date, end_date')
        .eq('project_id', projectId!)
        .neq('state', 'completed')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as SprintRow[]
    },
  })
}

// Epic progress for the backlog's epic list, from backlog_view (security invoker).
export function useEpicProgress(projectId: string | undefined) {
  return useQuery({
    queryKey: ['epic-progress', projectId],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<EpicProgress[]> => {
      const { data, error } = await supabase
        .from('backlog_view')
        .select('id, name, issue_count, done_count')
        .eq('project_id', projectId!)
        .eq('kind', 'epic')
      if (error) throw error
      return (data ?? []).map((row) => ({
        id: row.id as string,
        title: row.name as string,
        issue_count: Number(row.issue_count ?? 0),
        done_count: Number(row.done_count ?? 0),
      }))
    },
  })
}
