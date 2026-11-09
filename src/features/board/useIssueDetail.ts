import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type IssueRow = Database['public']['Tables']['issues']['Row']

// The full issue for the side panel. RLS limits it to issues the user can see.
export function useIssueDetail(issueId: string | null) {
  return useQuery({
    queryKey: ['issue', issueId],
    enabled: Boolean(issueId),
    queryFn: async (): Promise<IssueRow | null> => {
      const { data, error } = await supabase.from('issues').select('*').eq('id', issueId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}
