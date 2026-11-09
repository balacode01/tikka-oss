import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { LoaderCircle, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/Button'
import { Select } from '../../components/Select'
import { useSession } from '../../app/session-context'
import { applyTheme, readThemePreference, saveThemePreference, type ThemePreference } from '../../app/theme'
import { supabase } from '../../lib/supabase'
import { ProfileSkeleton } from './ProfileSkeleton'
import { avatarFileError, deleteAvatarFile, uploadAvatarFile } from './avatar'

const MAX_NAME_LENGTH = 100

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
]

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match system' },
]

const NOTIFICATIONS: { key: string; title: string; hint: string; initial: boolean }[] = [
  { key: 'assigned', title: 'Assigned to me', hint: 'Get an email when someone assigns an issue to you.', initial: true },
  { key: 'mentioned', title: 'Mentioned', hint: 'Get an email when someone mentions you in a comment.', initial: true },
  { key: 'watching', title: 'Updates to issues I watch', hint: 'Get an email when an issue you follow changes status or gets a comment.', initial: false },
  { key: 'sprint', title: 'Sprint started or completed', hint: 'Get an email when a sprint you are in starts or ends.', initial: true },
]

const DIGESTS = ['Daily', 'Weekly', 'Never']

const labelClass = 'font-medium text-sm text-text-primary'
const inputClass = 'h-8 w-full rounded-sm border border-border-strong bg-surface-raised px-3 text-sm text-text-primary'
const sectionTitle = 'font-medium text-[15px] text-text-primary'
const sectionText = 'text-sm text-text-primary'

// Your profile (settings), following the "Your profile" design. Name, job title and time zone are saved to
// the profiles row. The name is also written to the auth user metadata (read by the app shell and Create
// project), so both places always agree. Appearance is saved in this browser. Notification choices and the
// security actions are UI only until their backing data exists.
export function ProfileSettingsPage() {
  const { session } = useSession()
  const userId = session?.user.id
  const profile = useQuery({
    queryKey: ['my-profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, job_title, time_zone, avatar_url')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })

  if (profile.isPending) return <ProfileSkeleton />
  if (!profile.data || !session) return <p className="text-sm text-text-secondary">Your profile could not be loaded.</p>

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-8">
      <h1 className="font-semibold text-2xl text-text-primary">Your profile</h1>

      <nav aria-label="Profile sections" className="flex gap-6 border-border border-b text-sm">
        {TABS.map((tab, index) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            className={`-mb-px border-b-2 pb-2.5 ${index === 0 ? 'border-primary font-medium text-primary' : 'border-transparent text-text-primary hover:text-primary'}`}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      <ProfileSection
        key={session.user.id}
        email={session.user.email ?? ''}
        verified={Boolean(session.user.email_confirmed_at)}
        saved={{
          name: profile.data.display_name,
          jobTitle: profile.data.job_title ?? '',
          timeZone: profile.data.time_zone,
        }}
        avatarUrl={profile.data.avatar_url}
        avatarInitials={initialsOf(profile.data.display_name)}
      />
      <AppearanceSection />
      <NotificationsSection />
      <SecuritySection
        email={session.user.email ?? ''}
        googleLinked={session.user.identities?.some((identity) => identity.provider === 'google') ?? false}
      />
    </div>
  )
}

function initialsOf(name: string) {
  return name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

type ProfileDetails = { name: string; jobTitle: string; timeZone: string }

function ProfileSection({
  email,
  verified,
  saved: savedDetails,
  avatarUrl,
  avatarInitials,
}: {
  email: string
  verified: boolean
  saved: ProfileDetails
  avatarUrl: string | null
  avatarInitials: string
}) {
  const queryClient = useQueryClient()
  const photoInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(savedDetails.name)
  const [jobTitle, setJobTitle] = useState(savedDetails.jobTitle)
  const [timeZone, setTimeZone] = useState(savedDetails.timeZone)
  const [saved, setSaved] = useState(savedDetails)
  // Photo changes wait here until Save. A new photo is a file to upload; a removal clears the photo on save.
  const [newPhoto, setNewPhoto] = useState<{ file: File; preview: string } | null>(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [pending, setPending] = useState(false)

  // Free the preview address when the chosen photo changes or the section unmounts.
  useEffect(() => () => {
    if (newPhoto) URL.revokeObjectURL(newPhoto.preview)
  }, [newPhoto])

  const trimmed = name.trim()
  const trimmedJobTitle = jobTitle.trim()
  const nameError = submitted && trimmed.length === 0
    ? 'Enter your full name'
    : submitted && trimmed.length > MAX_NAME_LENGTH
      ? `Use ${MAX_NAME_LENGTH} characters or fewer`
      : undefined
  const photoChanged = newPhoto !== null || photoRemoved
  const changed = trimmed !== saved.name || trimmedJobTitle !== saved.jobTitle || timeZone !== saved.timeZone || photoChanged
  const shownPhoto = newPhoto ? newPhoto.preview : photoRemoved ? null : avatarUrl

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // lets the same file be chosen again
    if (!file) return

    const problem = avatarFileError(file)
    if (problem) {
      setPhotoError(problem)
      return
    }

    setPhotoError('')
    setPhotoRemoved(false)
    setNewPhoto({ file, preview: URL.createObjectURL(file) })
  }

  function removePhoto() {
    setPhotoError('')
    setNewPhoto(null)
    setPhotoRemoved(true)
  }

  function discard() {
    setName(saved.name)
    setJobTitle(saved.jobTitle)
    setTimeZone(saved.timeZone)
    setNewPhoto(null)
    setPhotoRemoved(false)
    setPhotoError('')
    setServerError('')
    setSubmitted(false)
  }

  // Saves the name, job title, time zone and photo together. The new photo is uploaded first. If the profile
  // update then fails, the uploaded file is removed again, so nothing is left behind.
  async function save(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (!changed || trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return

    setPending(true)
    // Resolve the signed-in user at save time, so the change always lands on the account that is active now.
    const { data: auth, error: userError } = await supabase.auth.getUser()
    const currentUserId = auth.user?.id
    if (userError || !currentUserId) {
      setPending(false)
      setServerError(userError?.message ?? 'Your session has ended. Log in again.')
      return
    }

    let uploadedUrl: string | null = null
    if (newPhoto) {
      try {
        uploadedUrl = await uploadAvatarFile(currentUserId, newPhoto.file)
      } catch (error) {
        setPending(false)
        setServerError(error instanceof Error ? error.message : 'The photo could not be uploaded. Try again.')
        return
      }
    }

    const next: ProfileDetails = { name: trimmed, jobTitle: trimmedJobTitle, timeZone }
    const photoFields = uploadedUrl !== null ? { avatar_url: uploadedUrl } : photoRemoved ? { avatar_url: null } : {}
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ display_name: next.name, job_title: next.jobTitle || null, time_zone: next.timeZone, ...photoFields })
      .eq('id', currentUserId)
      .select('display_name')
      .single()

    if (profileError) {
      if (uploadedUrl) await deleteAvatarFile(uploadedUrl)
      setPending(false)
      setServerError(profileError.message)
      return
    }

    // The old photo file is no longer used once the profile points at the new one or at nothing.
    if (photoChanged && avatarUrl) await deleteAvatarFile(avatarUrl)

    const { error: authError } = await supabase.auth.updateUser({ data: { display_name: next.name } })

    setSaved(next)
    setName(next.name)
    setJobTitle(next.jobTitle)
    setSubmitted(false)
    await queryClient.invalidateQueries()
    setNewPhoto(null)
    setPhotoRemoved(false)
    setPending(false)

    if (authError) {
      setServerError(authError.message)
      return
    }
    toast('Profile saved')
  }

  return (
    <section id="profile" className="scroll-mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>Profile</h2>
        <p className={sectionText}>This is how people in your workspaces see you.</p>
      </div>

      <form noValidate onSubmit={save} className="flex flex-col gap-4">
        {pending && (
          <div role="status" aria-live="polite" className="fixed inset-0 z-50 grid cursor-wait place-items-center bg-surface-page/60">
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface-raised px-5 py-4 text-sm font-medium text-text-primary shadow-popover">
              <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden="true" />
              Saving your profile
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            {shownPhoto ? (
              <img src={shownPhoto} alt="Your profile photo" className="size-20 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-full bg-surface-selected text-xl font-medium text-text-primary">
                {avatarInitials}
              </span>
            )}
            <Button disabled={pending} onClick={() => photoInput.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              {shownPhoto ? 'Replace photo' : 'Upload photo'}
            </Button>
            <Button disabled={!shownPhoto || pending} onClick={() => setConfirmRemove(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Remove
            </Button>
            <input
              ref={photoInput}
              type="file"
              accept="image/jpeg,image/png"
              onChange={choosePhoto}
              aria-label="Choose a profile photo"
              className="hidden"
            />
            <AlertDialog.Root open={confirmRemove} onOpenChange={setConfirmRemove}>
              <AlertDialog.Portal>
                <AlertDialog.Backdrop className="fixed inset-0 bg-black/40" />
                <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-6 text-text-primary shadow-modal">
                  <AlertDialog.Title className="font-semibold text-lg">Remove profile photo?</AlertDialog.Title>
                  <AlertDialog.Description className="text-sm text-text-secondary">
                    Your photo is removed when you save changes. Your initials show instead.
                  </AlertDialog.Description>
                  <div className="flex justify-end gap-2">
                    <AlertDialog.Close className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-border-strong bg-surface-raised px-3 text-sm font-medium text-text-primary hover:bg-surface-hover">
                      Cancel
                    </AlertDialog.Close>
                    <AlertDialog.Close
                      onClick={removePhoto}
                      className="inline-flex h-8 cursor-pointer items-center rounded-sm bg-danger px-3 text-sm font-medium text-on-danger hover:opacity-90"
                    >
                      Remove photo
                    </AlertDialog.Close>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
          {photoError ? (
            <p role="alert" className="text-xs text-danger-text">{photoError}</p>
          ) : photoChanged ? (
            <p className="text-xs text-text-secondary">Click Save changes to keep this photo.</p>
          ) : (
            <p className="text-xs text-text-secondary">JPG or PNG, up to 2 MB.</p>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Full name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            aria-invalid={nameError ? true : undefined}
            className={`${inputClass} ${nameError ? 'border-danger' : ''}`}
          />
          {nameError && <span className="text-xs text-danger-text">{nameError}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Job title</span>
          <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Your job title" className={inputClass} />
        </label>

        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className={labelClass}>Email</span>
            {verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                <span aria-hidden="true">✓</span> Verified
              </span>
            )}
          </span>
          <input value={email} readOnly className={`${inputClass} bg-surface-page text-text-secondary`} />
          <span className="text-xs text-text-secondary">Used to sign in and send notifications.</span>
        </div>

        <label className="flex flex-col gap-1">
          <span className={labelClass}>Time zone</span>
          <Select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} aria-label="Time zone">
            {[...new Set([timeZone, ...timeZoneOptions()])].map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </Select>
        </label>

        {serverError && <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>}

        <div className="flex items-center gap-2">
          <Button variant="primary" type="submit" disabled={!changed || pending}>
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? 'Saving' : 'Save changes'}
          </Button>
          <Button disabled={!changed || pending} onClick={discard}>Discard</Button>
        </div>
      </form>
    </section>
  )
}

function timeZoneOptions() {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['UTC']
  }
}

function AppearanceSection() {
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference())

  function choose(next: ThemePreference) {
    setTheme(next)
    saveThemePreference(next)
    applyTheme(next)
  }

  return (
    <section id="appearance" className="scroll-mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>Appearance</h2>
        <p className={sectionText}>Choose how Tikka looks for you.</p>
      </div>

      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {THEMES.map((option) => {
          const selected = theme === option.value
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer flex-col gap-3 rounded-md border p-3 ${selected ? 'border-primary bg-surface-selected' : 'border-border-strong bg-surface-raised'}`}
            >
              <ThemePreview value={option.value} />
              <span className="flex items-center justify-between gap-2 text-sm font-medium text-text-primary">
                {option.label}
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={selected}
                  onChange={() => choose(option.value)}
                  className="size-4 accent-primary"
                />
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

function ThemePreview({ value }: { value: ThemePreference }) {
  if (value === 'system') {
    return (
      <span aria-hidden="true" className="flex h-20 overflow-hidden rounded-sm border border-border-strong">
        <span className="flex-1 bg-white p-2"><MiniPanel /></span>
        <span className="flex-1 bg-[#1d2b36] p-2"><MiniPanel dark /></span>
      </span>
    )
  }
  return (
    <span aria-hidden="true" className={`flex h-20 rounded-sm border border-border-strong p-2 ${value === 'dark' ? 'bg-[#1d2b36]' : 'bg-[#e9ebee]'}`}>
      <MiniPanel dark={value === 'dark'} />
    </span>
  )
}

function MiniPanel({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`flex h-full flex-col gap-1.5 rounded-sm p-2 ${dark ? 'bg-[#0f1a22]' : 'bg-white'}`}>
      <span className={`h-1 w-3/5 rounded-full ${dark ? 'bg-slate-300' : 'bg-[#071b2b]'}`} />
      <span className={`h-1 w-2/5 rounded-full ${dark ? 'bg-slate-500' : 'bg-[#13324d]'}`} />
      <span className={`mt-auto h-3 rounded-sm ${dark ? 'bg-[#3a5366]' : 'bg-[#d6d9de]'}`} />
    </span>
  )
}

function NotificationsSection() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NOTIFICATIONS.map((n) => [n.key, n.initial])),
  )
  const [digest, setDigest] = useState('Weekly')

  return (
    <section id="notifications" className="scroll-mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>Notifications</h2>
        <p className={sectionText}>Choose what you get emailed about.</p>
      </div>

      <div className="flex flex-col gap-4">
        {NOTIFICATIONS.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text-primary">{item.title}</span>
              <span className="text-sm text-text-primary">{item.hint}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="w-6 text-sm text-text-primary">{enabled[item.key] ? 'On' : 'Off'}</span>
              <Switch
                label={item.title}
                checked={enabled[item.key]}
                onChange={(next) => setEnabled((state) => ({ ...state, [item.key]: next }))}
              />
            </div>
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Email digest</span>
        <Select value={digest} onChange={(e) => setDigest(e.target.value)}>
          {DIGESTS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </Select>
        <span className="text-xs text-text-secondary">A summary of activity in your projects.</span>
      </label>
    </section>
  )
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors ${checked ? 'border-primary bg-primary' : 'border-primary bg-surface-raised'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 size-3.5 rounded-full transition-transform ${checked ? 'translate-x-[18px] bg-on-primary' : 'translate-x-0.5 bg-primary'}`}
      />
    </button>
  )
}

function SecuritySection({ email, googleLinked }: { email: string; googleLinked: boolean }) {
  return (
    <section id="security" className="scroll-mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>Security</h2>
        <p className={sectionText}>Keep your account protected.</p>
      </div>

      <div>
        <Button onClick={() => toast('Changing your password is not available yet')}>Change password</Button>
      </div>

      {googleLinked && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-strong bg-surface-raised p-4">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-sm border border-border-strong bg-surface-raised text-sm font-medium">G</span>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">Signed in with Google</span>
              <span className="text-sm text-text-primary">Connected to {email}</span>
            </div>
          </div>
          <Button onClick={() => toast('Disconnecting Google is not available yet')}>Disconnect</Button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 border-border border-t pt-8">
        <h2 className={sectionTitle}>Delete account</h2>
        <p className={sectionText}>Deleting your account removes your access to your workspaces. This can&apos;t be undone.</p>
        <div>
          <button
            type="button"
            onClick={() => toast('Deleting an account is not available yet')}
            className="inline-flex h-8 cursor-pointer items-center rounded-sm border border-danger bg-surface-raised px-3 text-sm font-medium text-danger-text hover:bg-danger-bg"
          >
            Delete your account
          </button>
        </div>
      </div>
    </section>
  )
}
