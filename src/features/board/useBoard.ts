import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type StatusCategory = 'todo' | 'in_progress' | 'done'

export type BoardStatus = {
  id: string
  name: string
  category: StatusCategory
  position: number
}

export type BoardIssue = {
  id: string
  key: string
  type: 'epic' | 'story' | 'task' | 'bug' | 'subtask'
  title: string
  priority: 'urgent' | 'high' | 'medium' | 'low'
  status_id: string
  rank: number
  story_points: number | null
  assignee_id: string | null
  parent_id: string | null
  comments: number
}

export type BoardMember = { id: string; name: string }

export type Board = {
  project: { id: string; key: string; name: string; workspace_id: string }
  statuses: BoardStatus[]
  issues: BoardIssue[]
}

// Loads the project, its statuses and its issues. Reads go through RLS, so the
// user only gets rows they can see.
export function useBoard(workspaceSlug: string, projectKey: string) {
  return useQuery({
    queryKey: ['board', workspaceSlug, projectKey],
    queryFn: async (): Promise<Board | null> => {
      const { data: ws, error: wsError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', workspaceSlug)
        .maybeSingle()
      if (wsError) throw wsError
      if (!ws) return null

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, key, name, workspace_id')
        .eq('workspace_id', ws.id)
        .eq('key', projectKey)
        .maybeSingle()
      if (projectError) throw projectError
      if (!project) return null

      const [statuses, issues] = await Promise.all([
        supabase
          .from('statuses')
          .select('id, name, category, position')
          .eq('project_id', project.id)
          .order('position'),
        supabase
          .from('issues')
          .select('id, key, type, title, priority, status_id, rank, story_points, assignee_id, parent_id, comments(count)')
          .eq('project_id', project.id)
          .is('deleted_at', null)
          .order('rank'),
      ])
      if (statuses.error) throw statuses.error
      if (issues.error) throw issues.error

      return {
        project,
        statuses: statuses.data as BoardStatus[],
        issues: (issues.data ?? []).map((row) => ({
          ...row,
          comments: row.comments?.[0]?.count ?? 0,
        })) as BoardIssue[],
      }
    },
  })
}

// Members of the workspace, for assignee avatars and the assignee picker.
export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['members', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<BoardMember[]> => {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('user_id, profiles(display_name)')
        .eq('workspace_id', workspaceId!)
        .neq('role', 'guest')
      if (error) throw error
      return (data ?? []).map((row) => {
        const profile = row.profiles as unknown as { display_name: string } | null
        return { id: row.user_id, name: profile?.display_name ?? 'Member' }
      })
    },
  })
}

// Rank rule from the server (move_issue): midpoint between neighbours, or one step past an end.
export function estimateRank(above: number | undefined, below: number | undefined, fallbackBottom: number): number {
  if (above === undefined && below === undefined) return fallbackBottom
  if (above === undefined) return (below as number) - 1000
  if (below === undefined) return above + 1000
  return (above + below) / 2
}

export type MoveInput = {
  issueId: string
  statusId: string
  beforeId: string | null
  afterId: string | null
}

// Moves an issue. The board updates at once, and rolls back if the server refuses.
export function useMoveIssue(board: { workspaceSlug: string; projectKey: string }) {
  const queryClient = useQueryClient()
  const key = ['board', board.workspaceSlug, board.projectKey]

  return useMutation({
    mutationFn: async (input: MoveInput) => {
      const { error } = await supabase.rpc('move_issue', {
        p_issue: input.issueId,
        p_status: input.statusId,
        p_before: input.beforeId,
        p_after: input.afterId,
      })
      if (error) throw error
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Board | null>(key)
      if (previous) {
        const column = previous.issues
          .filter((i) => i.status_id === input.statusId && i.id !== input.issueId)
          .sort((a, b) => a.rank - b.rank)
        const above = column.find((i) => i.id === input.beforeId)?.rank
        const below = column.find((i) => i.id === input.afterId)?.rank
        const bottom = (column.at(-1)?.rank ?? 0) + 1000
        const rank = estimateRank(above, below, bottom)
        queryClient.setQueryData<Board | null>(key, (old) =>
          old && {
            ...old,
            issues: old.issues.map((i) =>
              i.id === input.issueId ? { ...i, status_id: input.statusId, rank } : i,
            ),
          },
        )
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
    },
  })
}
