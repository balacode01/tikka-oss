import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import { useParams } from 'react-router'

// M4 placeholder: the project loads and the Board shows its empty state.
// Columns and cards arrive in M5.
export function BoardPage() {
  const { workspace = '', key = '' } = useParams()

  const project = useQuery({
    queryKey: ['project', workspace, key],
    queryFn: async () => {
      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', workspace)
        .maybeSingle()
      if (wsError) throw wsError
      if (!ws) return null

      const { data, error } = await supabase
        .from('projects')
        .select('id, key, name')
        .eq('workspace_id', ws.id)
        .eq('key', key)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })

  if (project.isPending) return <p className="text-sm text-text-secondary">Loading the board</p>
  if (!project.data) {
    return <p className="text-sm text-text-secondary">This project was not found, or you cannot see it.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-xl">Board</h1>
        <p className="font-mono text-xs text-text-secondary">{project.data.key} · {project.data.name}</p>
      </div>
      <section className="flex flex-col items-start gap-3 rounded-md border border-border bg-surface-raised p-8">
        <h2 className="font-medium text-base">No issues yet</h2>
        <p className="text-sm text-text-secondary">Create your first issue to start tracking work on this board.</p>
        <Button variant="primary" onClick={() => toast('Create issue arrives in the next milestone')}>
          Create issue
        </Button>
      </section>
    </div>
  )
}
