import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './AuthLayout'
import { authErrorMessage, EMAIL_PATTERN } from './authErrors'

// Step 1 of password recovery: ask for the email. The reset link returns to /reset.
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState('')

  const emailError = submitted && !EMAIL_PATTERN.test(email) ? 'Enter a valid email address' : undefined

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (emailError) return

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    })
    if (error) {
      setServerError(authErrorMessage(error.message))
      return
    }
    // Same message whether or not the account exists, so the form cannot be used to find accounts.
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout>
        <h1 className="font-semibold text-xl text-text-primary">Check your email</h1>
        <p className="text-sm text-text-secondary">
          If an account exists for {email}, a reset link is on its way. The link expires in one hour.
        </p>
        <p className="text-sm">
          <Link to="/login" className="font-medium text-primary">Back to log in</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="font-semibold text-xl text-text-primary">Reset your password</h1>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          id="fp-email"
          label="Work email"
          type="email"
          placeholder="name@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        {serverError && (
          <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>
        )}
        <Button variant="primary" type="submit" fullWidth>Send reset link</Button>
      </form>
      <p className="text-center text-sm">
        <Link to="/login" className="font-medium text-primary">Back to log in</Link>
      </p>
    </AuthLayout>
  )
}

// Step 2: the link from the email signs the user in briefly; they choose a new password here.
export function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [done, setDone] = useState(false)
  const [serverError, setServerError] = useState('')

  const passwordError = submitted && password.length < 8 ? 'Use at least 8 characters' : undefined

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (passwordError) return

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setServerError(authErrorMessage(error.message))
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <AuthLayout>
        <h1 className="font-semibold text-xl text-text-primary">Password updated</h1>
        <p className="text-sm text-text-secondary">Use your new password next time you log in.</p>
        <p className="text-sm">
          <Link to="/home" className="font-medium text-primary">Go to Your work</Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="font-semibold text-xl text-text-primary">Choose a new password</h1>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          id="rp-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          hint="At least 8 characters"
        />
        {serverError && (
          <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">{serverError}</p>
        )}
        <Button variant="primary" type="submit" fullWidth>Save password</Button>
      </form>
    </AuthLayout>
  )
}
