import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { safeNext } from './safeNext'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './AuthLayout'
import { authErrorMessage, EMAIL_PATTERN } from './authErrors'

export function SignUpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)
  const [awaitingEmail, setAwaitingEmail] = useState(false)
  const [resent, setResent] = useState(false)

  const nameError = submitted && name.trim().length === 0 ? 'Enter your full name' : undefined
  const emailError = submitted && !EMAIL_PATTERN.test(email)
    ? 'Enter a valid email address, like name@company.com'
    : undefined
  const passwordError = submitted && password.length < 8 ? 'Use at least 8 characters' : undefined

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (nameError || emailError || passwordError || !agreed) return

    setPending(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name.trim() } },
    })
    setPending(false)

    if (error) {
      setServerError(authErrorMessage(error.message))
      return
    }
    // With "Confirm email" on, there is no session yet: show the check-email screen.
    if (data.session) {
      navigate(safeNext(searchParams.get('next'), '/onboarding'), { replace: true })
    } else {
      setAwaitingEmail(true)
    }
  }

  async function resend() {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResent(!error)
    if (error) setServerError(authErrorMessage(error.message))
  }

  if (awaitingEmail) {
    return (
      <AuthLayout>
        <span className="grid size-12 place-items-center rounded-full bg-surface-selected text-primary-subtle-text" aria-hidden="true">
          @
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-semibold text-xl text-text-primary">Check your email</h1>
          <p className="text-sm text-text-secondary">
            We sent a verification link to <span className="font-medium text-text-primary">{email}</span>. It
            expires in 24 hours.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button fullWidth onClick={resend}>Resend email</Button>
          <p role="status" className="min-h-4 text-center text-xs text-text-secondary">
            {resent ? 'Link sent again' : serverError}
          </p>
        </div>
        <p className="text-center text-sm">
          <button type="button" className="font-medium text-primary underline" onClick={() => setAwaitingEmail(false)}>
            Use a different email
          </button>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="font-semibold text-xl text-text-primary">Create your Tikka account</h1>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          id="su-name"
          label="Full name"
          placeholder="Your full name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />
        <Field
          id="su-email"
          label="Work email"
          type="email"
          placeholder="name@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <Field
          id="su-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          hint="At least 8 characters"
        />

        <label className="flex items-start gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            I agree to the <a href="#terms" className="text-primary underline">Terms of Service</a> and{' '}
            <a href="#privacy" className="text-primary underline">Privacy Policy</a>
          </span>
        </label>
        {submitted && !agreed && (
          <p className="text-xs text-danger-text">Accept the terms to create your account</p>
        )}

        {serverError && (
          <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">
            {serverError}
          </p>
        )}

        <Button variant="primary" type="submit" fullWidth disabled={pending}>
          {pending ? 'Creating account' : 'Create account'}
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
