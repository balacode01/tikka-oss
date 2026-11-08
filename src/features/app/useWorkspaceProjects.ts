import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type Project = { id: string; key: string; name: string }

// Lists the projects of a workspace. RLS limits the rows to what the user can see.
export function useWorkspaceProjects(workspaceSlug: string | undefined) {
  return useQuery({
    queryKey: ['projects', workspaceSlug],
    enabled: Boolean(workspaceSlug),
    queryFn: async () => {
      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .select('id, name, slug')
        .eq('slug', workspaceSlug!)
        .maybeSingle()
      if (wsError) throw wsError
      if (!ws) return { workspace: null, projects: [] as Project[] }

      const { data, error } = await supabase
        .from('projects')
        .select('id, key, name')
        .eq('workspace_id', ws.id)
        .is('archived_at', null)
        .order('name')
      if (error) throw error
      return { workspace: ws, projects: (data ?? []) as Project[] }
    },
  })
}
