import { Dialog } from '@base-ui/react/dialog'
import { Copy, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { inviteLink, useCreateInvite, useRevokeInvite, useWorkspaceInvites, type WorkspaceRole } from './useInvites'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  myRole: WorkspaceRole
  projects: { id: string; name: string }[]
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Invite people (owners and admins). Each email gets its own link. The link works for people with
// an account and for people who sign up, as long as they use the invited email.
export function InviteDialog({ open, onOpenChange, workspaceId, myRole, projects }: Props) {
  const [emails, setEmails] = useState('')
  const [role, setRole] = useState<'admin' | 'member' | 'guest'>('member')
  const [projectId, setProjectId] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const invites = useWorkspaceInvites(open ? workspaceId : undefined)
  const create = useCreateInvite(workspaceId)
  const revoke = useRevokeInvite(workspaceId)

  const list = emails.split(/[\s,]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const bad = list.filter((e) => !EMAIL.test(e))
    if (list.length === 0) return setError('Enter at least one email address')
    if (bad.length > 0) return setError(`Check these addresses: ${bad.join(', ')}`)

    setPending(true)
    try {
      for (const email of list) {
        await create.mutateAsync({ email, role, projectId: projectId || null })
      }
      setEmails('')
      toast(list.length === 1 ? 'Invite link created' : `${list.length} invite links created`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The invite could not be created. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(inviteLink(token))
    toast('Link copied. Send it to the person you invited.')
  }

  const openInvites = (invites.data ?? []).filter((i) => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date())

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-lg border border-border bg-surface-raised p-6 text-text-primary shadow-modal">
          <div className="flex items-center justify-between">
            <Dialog.Title className="font-semibold text-xl">Invite people</Dialog.Title>
            <Dialog.Close aria-label="Close" className="grid size-8 cursor-pointer place-items-center rounded-sm text-text-secondary hover:bg-surface-hover">
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Email addresses
              <textarea
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={2}
                placeholder="name@company.com, another@company.com"
                className="rounded-sm border border-border-strong bg-surface-raised px-3 py-2 text-sm font-normal"
              />
              <span className="text-xs font-normal text-text-secondary">Separate addresses with commas or spaces.</span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Role
                <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                  <option value="member">Member</option>
                  <option value="guest">Guest</option>
                  {myRole === 'owner' && <option value="admin">Admin</option>}
                </Select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Project
                <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Whole workspace</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </label>
            </div>
            <p className="text-[13px] text-text-secondary">
              {role === 'guest' ? 'Guests can see and comment on the projects they are added to.' : 'Members can see every open project in the workspace.'}
            </p>

            {error && <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{error}</p>}

            <div className="flex justify-end">
              <Button variant="primary" type="submit" disabled={pending}>{pending ? 'Creating links' : 'Create invite links'}</Button>
            </div>
          </form>

          <section className="flex flex-col gap-2 border-border border-t pt-4">
            <h3 className="font-medium text-sm">Open invites <span className="text-text-secondary tabular-nums">{openInvites.length}</span></h3>
            {openInvites.length === 0 && <p className="text-sm text-text-secondary">No open invites. New links appear here.</p>}
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {openInvites.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{inv.email}</span>
                  <span className="text-xs text-text-secondary capitalize">{inv.role}</span>
                  <button type="button" onClick={() => copy(inv.token)} className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover">
                    <Copy className="size-3.5" aria-hidden="true" /> Copy link
                  </button>
                  <button type="button" onClick={() => revoke.mutate(inv.id, { onError: (e) => toast(e.message) })} className="cursor-pointer text-[13px] font-medium text-danger-text hover:underline">
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
