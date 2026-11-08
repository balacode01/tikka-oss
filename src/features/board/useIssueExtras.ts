import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type SubIssue = { id: string; key: string; title: string; status_id: string; assignee_id: string | null }

export type LinkedIssue = {
  id: string
  key: string
  title: string
  link_type: 'blocks' | 'relates_to'
  direction: 'outgoing' | 'incoming'
}

export type CommentRow = { id: string; body: string; created_at: string; author_id: string | null; edited_at: string | null }

export type HistoryRow = {
  id: number
  field: string
  old_value: string | null
  new_value: string | null
  actor_id: string | null
  created_at: string
}

// Sub-tasks, linked issues, comments, history and watchers for the side panel.
// Every read goes through RLS, so only what the user can see comes back.
export function useIssueExtras(issueId: string | null, projectId: string | null) {
  const subtasks = useQuery({
    queryKey: ['subtasks', issueId],
    enabled: Boolean(issueId),
    queryFn: async (): Promise<SubIssue[]> => {
      const { data, error } = await supabase
        .from('issues')
        .select('id, key, title, status_id, assignee_id')
        .eq('parent_id', issueId!)
        .is('deleted_at', null)
        .order('rank')
      if (error) throw error
      return data ?? []
    },
  })

  const links = useQuery({
    queryKey: ['links', issueId],
    enabled: Boolean(issueId),
    queryFn: async (): Promise<LinkedIssue[]> => {
      const { data, error } = await supabase
        .from('issue_links')
        .select('id, link_type, source_issue_id, target_issue_id, source:issues!source_issue_id(key, title), target:issues!target_issue_id(key, title)')
        .or(`source_issue_id.eq.${issueId},target_issue_id.eq.${issueId}`)
      if (error) throw error
      return (data ?? []).map((row) => {
        const outgoing = row.source_issue_id === issueId
        const other = (outgoing ? row.target : row.source) as unknown as { key: string; title: string }
        return {
          id: row.id,
          key: other.key,
          title: other.title,
          link_type: row.link_type as LinkedIssue['link_type'],
          direction: outgoing ? 'outgoing' : 'incoming',
        }
      })
    },
  })

  const comments = useQuery({
    queryKey: ['comments', issueId],
    enabled: Boolean(issueId),
    queryFn: async (): Promise<CommentRow[]> => {
      const { data, error } = await supabase
        .from('comments')
        .select('id, body, created_at, author_id, edited_at')
        .eq('issue_id', issueId!)
        .is('deleted_at', null)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
  })

  const history = useQuery({
    queryKey: ['history', issueId],
    enabled: Boolean(issueId),
    queryFn: async (): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from('issue_history')
        .select('id, field, old_value, new_value, actor_id, created_at')
        .eq('issue_id', issueId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  const watchers = useQuery({
    queryKey: ['watchers', issueId],
    enabled: Boolean(issueId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('watchers').select('user_id').eq('issue_id', issueId!)
      if (error) throw error
      return (data ?? []).map((w) => w.user_id)
    },
  })

  const queryClient = useQueryClient()
  const refresh = (what: string) => queryClient.invalidateQueries({ queryKey: [what, issueId] })

  const addComment = useMutation({
    mutationFn: async ({ body, authorId }: { body: string; authorId: string }) => {
      const { error } = await supabase.from('comments').insert({ issue_id: issueId!, author_id: authorId, body })
      if (error) throw error
    },
    onSuccess: () => refresh('comments'),
  })

  const addSubtask = useMutation({
    mutationFn: async ({ title, status }: { title: string; status: string | null }) => {
      const { error } = await supabase.rpc('create_issue', {
        p_project: projectId!,
        p_type: 'subtask',
        p_title: title,
        p_description: null,
        p_status: status,
        p_priority: 'medium',
        p_assignee: null,
        p_sprint: null,
        p_epic: null,
        p_parent: issueId!,
        p_points: null,
        p_due: null,
        p_labels: null,
      })
      if (error) throw error
    },
    onSuccess: () => refresh('subtasks'),
  })

  const addLink = useMutation({
    mutationFn: async ({ targetKey, type, authorId }: { targetKey: string; type: LinkedIssue['link_type']; authorId: string }) => {
      const { data: target, error: findError } = await supabase
        .from('issues')
        .select('id')
        .eq('project_id', projectId!)
        .eq('key', targetKey.trim().toUpperCase())
        .maybeSingle()
      if (findError) throw findError
      if (!target) throw new Error(`No issue with key ${targetKey} in this project. Check the key and try again.`)
      const { error } = await supabase.from('issue_links').insert({
        source_issue_id: issueId!,
        target_issue_id: target.id,
        link_type: type,
        created_by: authorId,
      })
      if (error) throw error
    },
    onSuccess: () => refresh('links'),
  })

  const toggleWatch = useMutation({
    mutationFn: async ({ userId, watching }: { userId: string; watching: boolean }) => {
      if (watching) {
        const { error } = await supabase.from('watchers').delete().eq('issue_id', issueId!).eq('user_id', userId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('watchers').insert({ issue_id: issueId!, user_id: userId })
        if (error) throw error
      }
    },
    onSuccess: () => refresh('watchers'),
  })

  return { subtasks, links, comments, history, watchers, addComment, addSubtask, addLink, toggleWatch }
}
