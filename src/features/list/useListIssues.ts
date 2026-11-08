import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type ListFilters = {
  q: string
  type: string[]
  status: string[]
  assignee: string[]
  priority: string[]
  sprint: string[] // sprint ids, or 'none' for the backlog
  epic: string[]
  sort: SortKey
  dir: 'asc' | 'desc'
}

export type SortKey = 'updated' | 'key' | 'title' | 'points'

export type ListRow = {
  id: string
  key: string
  type: 'epic' | 'story' | 'task' | 'bug' | 'subtask'
  title: string
  status_id: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  assignee_id: string | null
  story_points: number | null
  sprint_id: string | null
  epic_id: string | null
  updated_at: string
}

const SORT_COLUMN: Record<SortKey, string> = {
  updated: 'updated_at',
  key: 'number',
  title: 'title',
  points: 'story_points',
}

// Commas and brackets have a meaning inside PostgREST filters, so they are removed from the search text.
function cleanSearch(text: string) {
  return text.replace(/[,()*%]/g, ' ').trim()
}

// Issues in a project as a list, filtered and sorted on the server. Pages of 15 with an exact total.
export function useListIssues(projectId: string | undefined, filters: ListFilters, limit: number) {
  return useQuery({
    queryKey: ['list-issues', projectId, filters, limit],
    enabled: Boolean(projectId),
    queryFn: async (): Promise<{ rows: ListRow[]; total: number }> => {
      let query = supabase
        .from('issues')
        .select('id, key, number, type, title, status_id, priority, assignee_id, story_points, sprint_id, epic_id, updated_at', { count: 'exact' })
        .eq('project_id', projectId!)
        .is('deleted_at', null)

      if (filters.type.length) query = query.in('type', filters.type)
      if (filters.status.length) query = query.in('status_id', filters.status)
      if (filters.assignee.length) query = query.in('assignee_id', filters.assignee)
      if (filters.priority.length) query = query.in('priority', filters.priority)
      if (filters.epic.length) query = query.in('epic_id', filters.epic)

      const sprintIds = filters.sprint.filter((s) => s !== 'none')
      const includeBacklog = filters.sprint.includes('none')
      if (sprintIds.length && includeBacklog) {
        query = query.or(`sprint_id.in.(${sprintIds.join(',')}),sprint_id.is.null`)
      } else if (includeBacklog) {
        query = query.is('sprint_id', null)
      } else if (sprintIds.length) {
        query = query.in('sprint_id', sprintIds)
      }

      const search = cleanSearch(filters.q)
      if (search) query = query.or(`title.ilike.*${search}*,key.ilike.*${search}*`)

      query = query
        .order(SORT_COLUMN[filters.sort], { ascending: filters.dir === 'asc', nullsFirst: false })
        .range(0, limit - 1)

      const { data, error, count } = await query
      if (error) throw error
      return { rows: (data ?? []) as ListRow[], total: count ?? 0 }
    },
  })
}
