import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'
import { Button } from '../../components/Button'
import { useSession } from '../../app/session-context'
import { supabase } from '../../lib/supabase'

// Consent screen for apps that connect to Tikka through OAuth, such as Claude. Supabase sends the signed-in
// person here with an authorization_id. Approving gives the app the same access the person has in Tikka.
export function ConsentPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const authorizationId = params.get('authorization_id')
  const { session, loading } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const details = useQuery({
    queryKey: ['oauth-authorization', authorizationId],
    enabled: Boolean(session && authorizationId),
    queryFn: async () => {
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId!)
      if (error) throw error
      return data
    },
  })

  // The person has already approved this app, so send them straight back to it.
  useEffect(() => {
    const data = details.data
    if (data && !('authorization_id' in data)) window.location.href = data.redirect_url
  }, [details.data])

  if (loading) return <p className="p-8 text-sm text-text-secondary">Loading</p>
  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }
  if (!authorizationId) {
    return <Message title="This link is incomplete" body="Start the connection again from the app you are connecting to Tikka." />
  }
  if (details.isPending) return <p className="p-8 text-sm text-text-secondary">Loading the request</p>
  if (details.isError) {
    return <Message title="This request could not be loaded" body={details.error.message} />
  }
  if (!details.data || !('authorization_id' in details.data)) {
    return <p className="p-8 text-sm text-text-secondary">Taking you back to the app</p>
  }

  const request = details.data

  async function decide(approve: boolean) {
    setBusy(true)
    setError('')
    const result = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId!, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId!, { skipBrowserRedirect: true })
    if (result.error) {
      setBusy(false)
      setError(result.error.message)
      return
    }
    window.location.href = result.data.redirect_url
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border border-border bg-surface-raised p-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-xl">Allow {request.client.name} to use Tikka?</h1>
        <p className="text-sm text-text-secondary">
          {request.client.name} will be able to see the projects you can see and change issues you can change, as you can. Signed in as {request.user.email}.
        </p>
      </div>

      <p className="text-sm">
        <span className="text-text-secondary">Requested access: </span>
        {request.scope || 'Your Tikka projects'}
      </p>

      {error && <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{error}</p>}

      <div className="flex justify-end gap-2 border-border border-t pt-5">
        <Button disabled={busy} onClick={() => decide(false)}>Deny</Button>
        <Button variant="primary" disabled={busy} onClick={() => decide(true)}>
          {busy ? 'Working' : 'Allow'}
        </Button>
      </div>
    </div>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2 rounded-lg border border-border bg-surface-raised p-6">
      <h1 className="font-semibold text-xl">{title}</h1>
      <p className="text-sm text-text-secondary">{body}</p>
    </div>
  )
}
