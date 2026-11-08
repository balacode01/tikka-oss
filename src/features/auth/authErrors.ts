export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Maps Supabase Auth errors to messages that say what to do next (BRD §7.4).
export function authErrorMessage(message: string): string {
  const text = message.toLowerCase()
  if (text.includes('invalid login credentials')) {
    return 'That email and password do not match. Check them and try again.'
  }
  if (text.includes('already registered') || text.includes('already been registered')) {
    return 'An account with this email already exists. Log in instead.'
  }
  if (text.includes('rate limit')) {
    return 'Too many attempts. Wait a few minutes, then try again.'
  }
  if (text.includes('password should be at least')) {
    return 'Use at least 8 characters'
  }
  return 'Something went wrong. Try again in a moment.'
}
