import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { supabase } from '../../lib/supabase'

type Step = 1 | 2 | 3
type Created = { id: string; slug: string }

// Steps 1 and 3 are real. Step 2 (invites) is skip-only in the MVP (BRD §7.1).
export function CreateWorkspacePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [workspaceName, setWorkspaceName] = useState('')
  const [slug, setSlug] = useState('')
  const [created, setCreated] = useState<Created | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [template, setTemplate] = useState<'scrum' | 'kanban'>('scrum')
  const [access, setAccess] = useState<'open' | 'invite_only'>('open')
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)
  const [inviteNote, setInviteNote] = useState('')

  function suggestSlug(name: string) {
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  }

  function suggestKey(name: string) {
    const letters = name.toUpperCase().replace(/[^A-Z ]/g, '').split(' ').filter(Boolean)
    const key = letters.length > 1 ? letters.map((w) => w[0]).join('') : letters[0] ?? ''
    return key.slice(0, 4)
  }

  async function createWorkspace(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (workspaceName.trim().length === 0 || !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) return

    setPending(true)
    const { data, error } = await supabase.rpc('create_workspace', { p_name: workspaceName, p_slug: slug })
    setPending(false)

    if (error) {
      setServerError(error.message)
      return
    }
    setCreated({ id: data.id, slug: data.slug })
    setSubmitted(false)
    setStep(2)
  }

  async function createProject(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (!created || projectName.trim().length === 0 || !/^[A-Z]{2,10}$/.test(projectKey)) return

    setPending(true)
    const { data, error } = await supabase.rpc('create_project', {
      p_workspace: created.id,
      p_name: projectName,
      p_key: projectKey,
      p_template: template,
      p_access: access,
    })
    setPending(false)

    if (error) {
      setServerError(error.message)
      return
    }
    navigate(`/w/${created.slug}/p/${data.key}/board`, { replace: true })
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-surface-page px-4 py-12 text-text-primary">
      <div className="flex w-full max-w-[480px] flex-col gap-6">
        <p className="text-sm text-text-secondary">Step {step} of 3</p>

        {step === 1 && (
          <form noValidate onSubmit={createWorkspace} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-semibold text-xl">Create your workspace</h1>
              <p className="text-sm text-text-secondary">A workspace holds your team's projects.</p>
            </div>
            <Field
              id="ws-name"
              label="Workspace name"
              placeholder="Lumen Labs"
              value={workspaceName}
              onChange={(e) => {
                setWorkspaceName(e.target.value)
                setSlug(suggestSlug(e.target.value))
              }}
              error={submitted && workspaceName.trim().length === 0 ? 'Give the workspace a name' : undefined}
            />
            <Field
              id="ws-slug"
              label="Workspace URL"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              hint="Lowercase letters, numbers and hyphens"
              error={submitted && !/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)
                ? 'Use lowercase letters, numbers and hyphens, 3 to 60 characters'
                : undefined}
            />
            {serverError && <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>}
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? 'Creating workspace' : 'Continue'}
            </Button>
          </form>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-semibold text-xl">Invite your team</h1>
              <p className="text-sm text-text-secondary">You can invite people later from workspace settings.</p>
            </div>
            <Field id="inv-1" label="Email" type="email" placeholder="name@company.com" />
            <Field id="inv-2" label="Email" type="email" placeholder="name@company.com" />
            {inviteNote && <p className="text-sm text-text-secondary">{inviteNote}</p>}
            <div className="flex gap-2">
              <Button onClick={() => setInviteNote('Invites are not available yet. Skip for now to continue.')}>
                Send invites
              </Button>
              <Button variant="primary" onClick={() => setStep(3)}>Skip for now</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form noValidate onSubmit={createProject} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-semibold text-xl">Create your first project</h1>
              <p className="text-sm text-text-secondary">Issues live in projects. You can add more later.</p>
            </div>
            <Field
              id="pr-name"
              label="Project name"
              placeholder="Mobile app"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value)
                setProjectKey(suggestKey(e.target.value))
              }}
              error={submitted && projectName.trim().length === 0 ? 'Give the project a name' : undefined}
            />
            <Field
              id="pr-key"
              label="Key"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
              hint="2 to 10 capital letters. Issues get keys like MOB-1."
              error={submitted && !/^[A-Z]{2,10}$/.test(projectKey)
                ? 'Use 2 to 10 capital letters, such as MOB'
                : undefined}
            />
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Template</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="template" checked={template === 'scrum'} onChange={() => setTemplate('scrum')} className="accent-primary" />
                Scrum: sprints and a backlog
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="template" checked={template === 'kanban'} onChange={() => setTemplate('kanban')} className="accent-primary" />
                Kanban: one continuous board
              </label>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Access</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="access" checked={access === 'open'} onChange={() => setAccess('open')} className="accent-primary" />
                Open: all workspace members
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="access" checked={access === 'invite_only'} onChange={() => setAccess('invite_only')} className="accent-primary" />
                Invite only
              </label>
            </fieldset>
            {serverError && <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>}
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? 'Creating project' : 'Create project'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
