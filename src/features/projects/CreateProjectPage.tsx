import { useQuery } from '@tanstack/react-query'
import { Kanban, Repeat, type LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../app/session-context'
import { CreateProjectSkeleton } from './CreateProjectSkeleton'

type Template = 'scrum' | 'kanban'
type Access = 'open' | 'invite_only'

const TEMPLATES: { value: Template; label: string; description: string; icon: LucideIcon }[] = [
  { value: 'scrum', label: 'Scrum', description: 'Plan work in sprints with a backlog and a board.', icon: Repeat },
  { value: 'kanban', label: 'Kanban', description: 'Work flows continuously across a board. No sprints.', icon: Kanban },
]

const labelClass = 'flex flex-col gap-1.5 text-sm font-medium text-text-primary'
const inputClass = 'h-8 w-full rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-normal text-text-primary placeholder:text-text-secondary'

// Create project (M7), following the "Create project" artboard. Key rules and the duplicate-key message
// come from the create_project function, so the form and the database agree.
export function CreateProjectPage() {
  const { workspace = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()
  const ws = useQuery({
    queryKey: ['workspace-by-slug', workspace],
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces').select('id, name').eq('slug', workspace).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [template, setTemplate] = useState<Template>('scrum')
  const [access, setAccess] = useState<Access>('open')
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)

  const nameError = submitted && name.trim().length === 0 ? 'Give the project a name' : undefined
  const keyError = submitted && !/^[A-Z]{2,10}$/.test(key) ? 'Use 2 to 10 capital letters, such as MOB' : undefined

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (nameError || keyError || !ws.data) return

    setPending(true)
    const { data, error } = await supabase.rpc('create_project', {
      p_workspace: ws.data.id,
      p_name: name,
      p_key: key,
      p_template: template,
      p_access: access,
    })
    setPending(false)

    if (error) {
      setServerError(error.message)
      return
    }
    toast(`Project created: ${data.name}`)
    navigate(`/w/${workspace}/p/${data.key}/board`, { replace: true })
  }

  if (ws.isPending) return <CreateProjectSkeleton />
  if (!ws.data) return <p className="text-sm text-text-secondary">This workspace was not found, or you cannot see it.</p>

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-text-secondary">{ws.data.name} <span className="mx-1">/</span> Projects</p>
        <h1 className="font-semibold text-xl">Create project</h1>
      </div>

      <form noValidate onSubmit={submit} className="flex flex-col gap-5 rounded-lg border border-border bg-surface-raised p-6">
        <label className={labelClass}>
          Project name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer portal"
            aria-invalid={nameError ? true : undefined}
            className={`${inputClass} ${nameError ? 'border-danger' : ''}`}
          />
          {nameError && <span className="text-xs font-normal text-danger-text">{nameError}</span>}
        </label>

        <label className={labelClass}>
          Key
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="CP"
            maxLength={10}
            aria-invalid={keyError ? true : undefined}
            className={`${inputClass} w-40 font-mono ${keyError ? 'border-danger' : ''}`}
          />
          {keyError
            ? <span className="text-xs font-normal text-danger-text">{keyError}</span>
            : <span className="text-xs font-normal text-text-secondary">Issue keys will look like {key || 'CP'}-1. Use 2 to 10 capital letters.</span>}
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Template</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TEMPLATES.map((t) => {
              const Icon = t.icon
              const selected = template === t.value
              return (
                <label
                  key={t.value}
                  className={`flex cursor-pointer flex-col gap-2 rounded-md border p-4 ${selected ? 'border-primary bg-surface-selected' : 'border-border-strong'}`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    <span className="font-medium text-sm">{t.label}</span>
                    <input type="radio" name="template" value={t.value} checked={selected} onChange={() => setTemplate(t.value)} className="ml-auto size-4 accent-primary" />
                  </span>
                  <span className="text-[13px] text-text-secondary">{t.description}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Project lead</span>
          <span className="flex h-8 items-center text-sm">{session?.user.user_metadata?.display_name ?? session?.user.email} (you)</span>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Access</legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name="access" checked={access === 'open'} onChange={() => setAccess('open')} className="mt-1 size-4 accent-primary" />
            <span className="flex flex-col">
              <span>Everyone in {ws.data.name}</span>
              <span className="text-[13px] text-text-secondary">Anyone in the workspace can find and view the project.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="radio" name="access" checked={access === 'invite_only'} onChange={() => setAccess('invite_only')} className="mt-1 size-4 accent-primary" />
            <span className="flex flex-col">
              <span>Only people I add</span>
              <span className="text-[13px] text-text-secondary">The project stays hidden from everyone else.</span>
            </span>
          </label>
        </fieldset>

        {serverError && <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>}

        <div className="flex justify-end gap-2 border-border border-t pt-5">
          <Button onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={pending}>{pending ? 'Creating' : 'Create project'}</Button>
        </div>
      </form>
    </div>
  )
}
