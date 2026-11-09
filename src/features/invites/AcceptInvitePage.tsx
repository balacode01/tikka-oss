import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { AuthLayout } from '../auth/AuthLayout'
import { useSession } from '../../app/session-context'
import { supabase } from '../../lib/supabase'
import { AcceptInviteSkeleton } from './AcceptInviteSkeleton'

type InviteInfo = {
  status: 'valid' | 'used' | 'expired' | 'revoked' | 'not_found'
  workspace_name?: string
  inviter_name?: string
  role?: string
  email?: string
}

// The page behind an invite link. It works for people with an account and for new people:
// the link is the same, only the next step differs. Anyone can read the invite details; joining needs login.
export function AcceptInvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [pending, setPending] = useState(false)

  const invite = useQuery({
    queryKey: ['invite-info', token],
    queryFn: async (): Promise<InviteInfo> => {
      const { data, error } = await supabase.rpc('get_invite', { p_token: token })
      if (error) throw error
      return data as unknown as InviteInfo
    },
  })

  if (invite.isPending || loading) return <AcceptInviteSkeleton />

  const info = invite.data
  const next = `/invite/${token}`

  if (!info || info.status !== 'valid') {
    const message = info?.status === 'expired'
      ? 'This invite has expired. Ask the person who invited you to send a new one.'
      : info?.status === 'revoked'
        ? 'This invite was revoked. Ask for a new one.'
        : info?.status === 'used'
          ? 'This invite was already used.'
          : 'This invite link is not valid.'
    return (
      <AuthLayout>
        <h1 className="font-semibold text-xl">This invite can&rsquo;t be used</h1>
        <p className="text-sm text-text-secondary">{message}</p>
        <Link to="/" className="text-sm font-medium text-primary">Go to Tikka</Link>
      </AuthLayout>
    )
  }

  const invitedEmail = info.email ?? ''
  const signedInEmail = session?.user.email?.toLowerCase() ?? ''
  const emailMatches = signedInEmail === invitedEmail

  async function join() {
    setPending(true)
    const { error } = await supabase.rpc('accept_invite', { p_token: token })
    setPending(false)
    if (error) {
      toast(error.message)
      return
    }
    toast(`You joined ${info!.workspace_name}`)
    navigate('/home', { replace: true })
  }

  return (
    <AuthLayout>
      <h1 className="font-semibold text-xl">{info.inviter_name} invited you to join {info.workspace_name}</h1>
      <p className="text-sm text-text-secondary">You&rsquo;ll join as {info.role === 'admin' ? 'an admin' : `a ${info.role}`}.</p>

      {!session && (
        <div className="flex flex-col gap-3">
          <Link
            to={`/signup?email=${encodeURIComponent(invitedEmail)}&next=${encodeURIComponent(next)}`}
            className="flex h-8 items-center justify-center rounded-sm bg-primary text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Create account for {invitedEmail}
          </Link>
          <p className="text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-primary">Log in to accept</Link>
          </p>
        </div>
      )}

      {session && emailMatches && (
        <Button variant="primary" onClick={join} disabled={pending}>
          {pending ? 'Joining' : `Join ${info.workspace_name}`}
        </Button>
      )}

      {session && !emailMatches && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">
            You&rsquo;re logged in as {session.user.email}. This invite is for {invitedEmail}. Log in with that email to join.
          </p>
          <Button onClick={async () => { await supabase.auth.signOut(); navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true }) }}>
            Log out and log in as {invitedEmail}
          </Button>
        </div>
      )}
    </AuthLayout>
  )
}
