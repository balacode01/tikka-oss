import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { safeNext } from './safeNext'
import { Button } from '../../components/Button'
import { Field } from '../../components/Field'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from './AuthLayout'
import { authErrorMessage, EMAIL_PATTERN } from './authErrors'

export function LogInPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)

  const emailError = submitted && !EMAIL_PATTERN.test(email) ? 'Enter a valid email address' : undefined
  const passwordError = submitted && password.length === 0 ? 'Enter your password' : undefined

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    setServerError('')
    if (emailError || passwordError) return

    setPending(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setPending(false)

    if (error) {
      setServerError(authErrorMessage(error.message))
      return
    }
    navigate(safeNext(searchParams.get('next'), '/home'), { replace: true })
  }

  return (
    <AuthLayout>
      <h1 className="font-semibold text-xl text-text-primary">Log in to Tikka</h1>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          id="li-email"
          label="Work email"
          type="email"
          placeholder="name@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <div className="flex flex-col gap-1">
          <Field
            id="li-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordError}
          />
          <Link to="/forgot" className="self-end text-xs font-medium text-primary">
            Forgot password?
          </Link>
        </div>

        {serverError && (
          <p role="alert" className="rounded-sm bg-danger-bg p-2 text-sm text-danger-text">
            {serverError}
          </p>
        )}

        <Button variant="primary" type="submit" fullWidth disabled={pending}>
          {pending ? 'Logging in' : 'Log in'}
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        New to Tikka?{' '}
        <Link to="/signup" className="font-medium text-primary">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
