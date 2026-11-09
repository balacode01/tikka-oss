import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest'

export type InviteRow = {
  id: string
  email: string
  role: 'admin' | 'member' | 'guest'
  project_id: string | null
  token: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
}

// The signed-in user's role in a workspace. Owners and admins see the Invite people action.
export function useMyWorkspaceRole(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['my-role', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<WorkspaceRole | null> => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) return null
      const { data, error } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId!)
        .eq('user_id', me.user.id)
        .maybeSingle()
      if (error) throw error
      return (data?.role as WorkspaceRole | undefined) ?? null
    },
  })
}

// Open and recent invites for the workspace (owners and admins can read them through RLS).
export function useWorkspaceInvites(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['invites', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<InviteRow[]> => {
      const { data, error } = await supabase
        .from('invites')
        .select('id, email, role, project_id, token, expires_at, accepted_at, revoked_at')
        .eq('workspace_id', workspaceId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as InviteRow[]
    },
  })
}

export function useCreateInvite(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ email, role, projectId }: { email: string; role: InviteRow['role']; projectId: string | null }) => {
      const { data, error } = await supabase.rpc('create_invite', {
        p_workspace: workspaceId,
        p_email: email,
        p_role: role,
        p_project: projectId,
      })
      if (error) throw error
      return data as unknown as InviteRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', workspaceId] }),
  })
}

export function useRevokeInvite(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.rpc('revoke_invite', { p_invite: inviteId })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites', workspaceId] }),
  })
}

export function inviteLink(token: string) {
  return `${window.location.origin}/invite/${token}`
}
