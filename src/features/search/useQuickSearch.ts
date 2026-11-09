import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type SearchIssue = { id: string; key: string; title: string; project_id: string }
export type SearchProject = { id: string; key: string; name: string }
export type SearchResults = { issues: SearchIssue[]; projects: SearchProject[] }
export type RecentIssue = { id: string; key: string; title: string; project_id: string }

// Matches issue keys and titles, and project names, in one workspace. The search function
// only returns rows the user can see, so results never include other workspaces.
export function useSearchResults(workspaceId: string | undefined, query: string) {
  const text = query.trim()
  return useQuery({
    queryKey: ['search', workspaceId, text],
    enabled: Boolean(workspaceId) && text.length > 0,
    queryFn: async (): Promise<SearchResults> => {
      const { data, error } = await supabase.rpc('search', { p_workspace: workspaceId!, p_query: text })
      if (error) throw error
      const parsed = data as unknown as SearchResults
      return { issues: parsed.issues ?? [], projects: parsed.projects ?? [] }
    },
  })
}

// Issues the user opened most recently (up to 20 are kept by record_view).
export function useRecentIssues(enabled: boolean) {
  return useQuery({
    queryKey: ['recent-issues'],
    enabled,
    queryFn: async (): Promise<RecentIssue[]> => {
      const { data, error } = await supabase
        .from('recently_viewed')
        .select('issue:issues(id, key, title, project_id)')
        .order('viewed_at', { ascending: false })
        .limit(8)
      if (error) throw error
      return (data ?? [])
        .map((row) => row.issue as unknown as RecentIssue | null)
        .filter((issue): issue is RecentIssue => issue !== null)
    },
  })
}
