import { useState, type FormEvent, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.ts'
import { listProfileShortcuts, upsertProfileShortcut, type ProfileShortcut } from './profileShortcuts.ts'
import './signInPage.css'

export type SignInPageProps = {
  /** 'choose' (default) opens on the Google / Email options; 'form' opens the email form. */
  initialView?: 'choose' | 'form'
  initialEmail?: string
  initialError?: string | null
  onSuccess?: (profile: ProfileShortcut) => void
}

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
                    </svg>
)

export function defaultUsername(email: string) {
  const local = email.split('@')[0] ?? ''
  const cleaned = local.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 24)
  return cleaned || 'learner'
}

export function validateUsername(value: string): string | null {
  const name = value.trim()
  if (name.length < 2) return 'Use at least 2 characters.'
  if (name.length > 24) return 'Use 24 characters or fewer.'
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return 'Letters, numbers, dots, dashes and underscores only.'
  return null
}

/** Painting on the left, wordmark centred over the form on the right. */
export function AuthShell({
  label,
  children,
  footer,
}: {
  label: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="auth-page-root">
      <div className="auth-visual" aria-hidden="true">
        <p className="auth-visual-tagline">
          Miss it once / Master it twice.
        </p>
      </div>

      <div className="auth-panel">
        <a href="/" className="auth-close" aria-label="Back to the Clarity home page">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </a>
        <a href="/" className="auth-brandmark" aria-label="Clarity home">
          <span className="auth-brandmark-text">CLARITY</span>
          <svg className="auth-brandmark-seal" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="2" fill="#A83226" />
            <g fill="none" stroke="#F7F1E6" strokeWidth="2.4">
              <rect x="6" y="6" width="20" height="20" />
              <rect x="13" y="13" width="6" height="6" />
            </g>
          </svg>
        </a>
        <section className="auth-main-stage" aria-label={label}>
          <div className="auth-card-box">{children}</div>
        </section>
        {footer ? <footer className="auth-panel-footer">{footer}</footer> : null}
      </div>
    </main>
  )
}

export type UsernameStepProps = {
  email: string
  /** Resolve with an error message to keep the learner on this step. */
  onSubmit: (username: string) => Promise<string | null> | string | null
}

/** "Almost there": pick a public username, defaulting to the email name. */
export function UsernameStep({ email, onSubmit }: UsernameStepProps) {
  const [username, setUsername] = useState(() => defaultUsername(email))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const problem = validateUsername(username)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    const failure = await onSubmit(username.trim())
    if (failure) {
      setError(failure)
      setBusy(false)
    }
  }

  return (
    <AuthShell label="Choose your username">
      <h1 className="auth-title">Almost there</h1>
      <p className="auth-subtitle">Finish creating your Clarity account.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && (
          <div className="auth-alert-message auth-alert-message--error" role="alert">
            {error}
          </div>
        )}
        <div className="auth-field-group">
          <label htmlFor="auth-username" className="auth-field-label">
            Username
          </label>
          <input
            id="auth-username"
            className="auth-input-control"
            autoComplete="username"
            autoFocus
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="auth-field-hint">This is the name shown on your profile. You can change it later.</p>
        </div>
        <button type="submit" className="auth-submit-btn" disabled={busy}>
          {busy ? 'Please wait…' : 'Continue'}
        </button>
      </form>
    </AuthShell>
  )
}

export function SignInPage({
  initialView = 'choose',
  initialEmail = '',
  initialError = null,
  onSuccess,
}: SignInPageProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'forgot-password'>('sign-in')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [message, setMessage] = useState<string | null>(null)
  const [view, setView] = useState<'choose' | 'form'>(initialView)
  const [pendingLocal, setPendingLocal] = useState<ProfileShortcut | null>(null)

  /** Offline mode: a returning profile goes straight in, a new one picks a username first. */
  function finishLocal(profile: ProfileShortcut) {
    const existing = listProfileShortcuts().find((item) => item.id === profile.id)
    if (existing) {
      if (onSuccess) onSuccess(existing)
      return
    }
    setPendingLocal(profile)
  }

  async function handleGoogleSignIn() {
    setError(null)
    setMessage(null)
    if (!isSupabaseConfigured || !supabase) {
      // Local dev mode fallback - instantly log in and enter dashboard
      finishLocal({
        id: 'local-google-user',
        email: 'learner@gmail.com',
        displayName: 'learner',
        avatarId: 'orbit',
      })
      return
    }

    setBusy(true)
    const redirectUrl = `${window.location.origin}/app/`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    })

    if (oauthError) {
      setError(oauthError.message)
      setBusy(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    // Local / offline mode
    if (!isSupabaseConfigured || !supabase) {
      const cleanEmail = email.trim()
      const name = cleanEmail.split('@')[0] || 'Learner'
      finishLocal({
        id: `local-${cleanEmail}`,
        email: cleanEmail,
        displayName: name,
        avatarId: 'orbit',
      })
      return
    }

    // Forgot password flow
    if (mode === 'forgot-password') {
      setBusy(true)
      const redirectUrl = `${window.location.origin}/app/`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      })
      if (resetError) {
        setError(resetError.message)
      } else {
        setMessage('Check your email for a password reset link.')
      }
      setBusy(false)
      return
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    setBusy(true)
    const cleanEmail = email.trim()

    if (mode === 'sign-up') {
      const result = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { avatar_id: 'orbit' } },
      })
      if (result.error) {
        setError(result.error.message)
      } else if (!result.data.session) {
        setMessage('Check your email to confirm your account, then sign in.')
      } else if (result.data.user) {
        const profile = upsertProfileShortcut({
          id: result.data.user.id,
          email: result.data.user.email ?? cleanEmail,
          displayName: cleanEmail.split('@')[0],
          avatarId: 'orbit',
        })
        if (onSuccess) onSuccess(profile)
      }
    } else {
      const result = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })
      if (result.error) {
        setError(result.error.message)
      } else if (result.data.user) {
        const profile = upsertProfileShortcut({
          id: result.data.user.id,
          email: result.data.user.email ?? cleanEmail,
          displayName: (typeof result.data.user.user_metadata?.display_name === 'string' && result.data.user.user_metadata.display_name) || cleanEmail.split('@')[0],
          avatarId: 'orbit',
        })
        if (onSuccess) onSuccess(profile)
      }
    }

    setBusy(false)
  }

  if (pendingLocal) {
    return (
      <UsernameStep
        email={pendingLocal.email}
        onSubmit={(username) => {
          const profile = upsertProfileShortcut({ ...pendingLocal, displayName: username })
          if (onSuccess) onSuccess(profile)
          return null
        }}
      />
    )
  }

  if (view === 'choose') {
    return (
      <AuthShell
        label="Sign up for Clarity"
        footer={
          <>
            Already have an account?
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => {
                setMode('sign-in')
                setError(null)
                setView('form')
              }}
            >
              Sign in
            </button>
          </>
        }
      >
        <h1 className="auth-title auth-title--choose">Sign up</h1>
        {error && (
          <div className="auth-alert-message auth-alert-message--error" role="alert">
            {error}
          </div>
        )}
        <button
          type="button"
          className="auth-google-btn auth-google-btn--solid"
          onClick={handleGoogleSignIn}
          disabled={busy}
          aria-label="Continue with Google"
        >
          <span className="auth-google-icon" aria-hidden="true">
            {GOOGLE_ICON}
          </span>
          <span>Continue with Google</span>
        </button>
        <div className="auth-divider">
          <span>or</span>
        </div>
        <button
          type="button"
          className="auth-email-btn"
          onClick={() => {
            setMode('sign-up')
            setError(null)
            setView('form')
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
          </svg>
          <span>Email</span>
        </button>
      </AuthShell>
    )
  }

  return (
    <AuthShell label="Sign in to Clarity">
          <h1 className="auth-title">
            {mode === 'forgot-password'
              ? 'Reset password'
              : mode === 'sign-up'
              ? 'Create an account'
              : 'Welcome back'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'forgot-password'
              ? 'Enter your email to receive recovery instructions.'
              : mode === 'sign-up'
              ? 'Start your practice today.'
              : 'Continue your practice.'}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="auth-alert-message auth-alert-message--error" role="alert">
                {error}
              </div>
            )}
            {message && (
              <div className="auth-alert-message auth-alert-message--info" role="status">
                {message}
              </div>
            )}

            <div className="auth-field-group">
              <label htmlFor="auth-email" className="auth-field-label">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                className="auth-input-control"
                placeholder="name@example.com"
                aria-label="Email address"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {mode !== 'forgot-password' && (
              <div className="auth-field-group">
                <label htmlFor="auth-password" className="auth-field-label">
                  Password
                </label>
                <div className="auth-password-wrapper">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    className="auth-input-control"
                    placeholder="••••••••••••"
                    aria-label="Password"
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" y1="2" x2="22" y2="22" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {mode === 'sign-in' && (
              <div className="auth-forgot-row">
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setMode('forgot-password')
                    setError(null)
                    setMessage(null)
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={busy}
            >
              {busy
                ? 'Please wait…'
                : mode === 'forgot-password'
                ? 'Send reset link'
                : mode === 'sign-up'
                ? 'Create account'
                : 'Sign in'}
            </button>

            {mode !== 'forgot-password' && (
              <>
                <div className="auth-divider">
                  <span>or</span>
                </div>

                <button
                  type="button"
                  className="auth-google-btn"
                  onClick={handleGoogleSignIn}
                  disabled={busy}
                  aria-label="Continue with Google"
                >
                  <span className="auth-google-icon" aria-hidden="true">
                    {GOOGLE_ICON}
                  </span>
                  <span>Continue with Google</span>
                </button>
              </>
            )}

            {mode === 'sign-in' ? (
              <div className="auth-switch-prompt">
                New to Clarity?
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => {
                    setMode('sign-up')
                    setError(null)
                    setMessage(null)
                  }}
                >
                  Create an account
                </button>
              </div>
            ) : mode === 'sign-up' ? (
              <div className="auth-switch-prompt">
                Already have an account?
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => {
                    setMode('sign-in')
                    setError(null)
                    setMessage(null)
                  }}
                >
                  Sign in
                </button>
              </div>
            ) : (
              <div className="auth-switch-prompt">
                Remember your password?
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => {
                    setMode('sign-in')
                    setError(null)
                    setMessage(null)
                  }}
                >
                  Sign in
                </button>
              </div>
            )}
          </form>
    </AuthShell>
  )
}
