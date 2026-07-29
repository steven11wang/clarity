import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'

import { isSupabaseConfigured, supabase } from '../lib/supabase.ts'
import { restoreOrSeedCloudState, syncCloudState } from '../storage/cloud.ts'
import { subscribeStorageChanges } from '../storage/index.ts'

type AuthBoundaryProps = {
  children: ReactNode
}

export function AuthBoundary({ children }: AuthBoundaryProps) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(isSupabaseConfigured)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const syncedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setSyncError(error.message)
      setUser(data.session?.user ?? null)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setChecking(false)
      if (!session) syncedUserId.current = null
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user || syncedUserId.current === user.id) return
    let active = true
    setSyncing(true)
    setSyncError(null)
    void restoreOrSeedCloudState(user)
      .then(() => {
        if (active) syncedUserId.current = user.id
      })
      .catch((error: unknown) => {
        if (active) {
          setSyncError(error instanceof Error ? error.message : 'Cloud sync failed.')
        }
      })
      .finally(() => {
        if (active) setSyncing(false)
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!user || syncedUserId.current !== user.id) return
    let timer: number | undefined
    const unsubscribe = subscribeStorageChanges(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        setSyncError(null)
        void syncCloudState(user).catch((error: unknown) => {
          setSyncError(error instanceof Error ? error.message : 'Cloud sync failed.')
        })
      }, 350)
    })
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [user, syncing])

  if (!isSupabaseConfigured) {
    return (
      <LocalProfileGate>{children}</LocalProfileGate>
    )
  }

  if (checking || syncing) {
    return (
      <main className="app-status" aria-live="polite">
        <span className="wordmark">clarity<span>.</span></span>
        <p>{checking ? 'Checking your account…' : 'Restoring your progress…'}</p>
      </main>
    )
  }

  if (!user) {
    return <SignIn />
  }

  return (
    <>
      <div className="account-chip">
        <span title={user.email}>{user.email}</span>
        <button
          type="button"
          onClick={() => {
            void supabase!.auth.signOut()
          }}
        >
          Sign out
        </button>
      </div>
      {syncError && (
        <div className="sync-warning" role="status">
          Saved on this device. Cloud sync will retry after your next change. {syncError}
        </div>
      )}
      {children}
    </>
  )
}

function LocalProfileGate({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState(
    () => window.sessionStorage.getItem('clarity-active-profile') === 'Dara',
  )

  if (selected) {
    return (
      <>
        <div className="account-chip account-chip--local" title="Progress is saved on this device">
          Dara · local profile
        </div>
        {children}
      </>
    )
  }

  return (
    <main className="profile-gate">
      <div className="profile-gate__scanlines" aria-hidden="true" />
      <div className="profile-gate__motes" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
      </div>
      <section className="profile-gate__content" aria-labelledby="profile-gate-title">
        <h1 id="profile-gate-title">Welcome back to Clarity</h1>
        <p>Who’s studying?</p>
        <div className="profile-gate__profiles">
          <button className="profile-gate__add" type="button" aria-label="Add another user">
            <span>+</span>
            <strong>Add User</strong>
          </button>
          <div className="profile-gate__learner">
            <span className="profile-gate__controller" aria-hidden="true">▰</span>
            <small>1</small>
            <button
              className="profile-gate__avatar"
              type="button"
              onClick={() => {
                window.sessionStorage.setItem('clarity-active-profile', 'Dara')
                setSelected(true)
              }}
              aria-label="Continue as Dara"
            >
              <span>⌁</span>
            </button>
            <strong>Dara</strong>
            <p>Equipped · Mira, evidence scout</p>
            <span className="profile-gate__options">▤ &nbsp; Options</span>
          </div>
        </div>
        <button className="profile-gate__power" type="button" aria-label="Exit Clarity">↻</button>
      </section>
    </main>
  )
}

function SignIn() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    setMessage(null)

    const result =
      mode === 'sign-up'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName.trim() || undefined } },
          })
        : await supabase.auth.signInWithPassword({ email, password })

    if (result.error) {
      setError(result.error.message)
    } else if (mode === 'sign-up' && !result.data.session) {
      setMessage('Check your email to confirm your account, then sign in here.')
    }
    setBusy(false)
  }

  if (!showForm) {
    return (
      <main className="profile-gate">
        <div className="profile-gate__scanlines" aria-hidden="true" />
        <div className="profile-gate__motes" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
        </div>
        <section className="profile-gate__content" aria-labelledby="profile-gate-title">
          <h1 id="profile-gate-title">Welcome back to Clarity</h1>
          <p>Who’s studying?</p>
          <div className="profile-gate__profiles">
            <button
              className="profile-gate__add"
              type="button"
              onClick={() => {
                setMode('sign-up')
                setShowForm(true)
              }}
            >
              <span>+</span>
              <strong>Add User</strong>
            </button>
            <div className="profile-gate__learner">
              <span className="profile-gate__controller" aria-hidden="true">▰</span>
              <small>1</small>
              <button
                className="profile-gate__avatar"
                type="button"
                onClick={() => {
                  setMode('sign-in')
                  setShowForm(true)
                }}
                aria-label="Sign in as Dara"
              >
                <span>⌁</span>
              </button>
              <strong>Dara</strong>
              <p>Equipped · Mira, evidence scout</p>
              <button
                className="profile-gate__options profile-gate__options--button"
                type="button"
                onClick={() => setShowForm(true)}
              >
                ▤ &nbsp; Sign-in options
              </button>
            </div>
          </div>
          <span className="profile-gate__power" aria-hidden="true">↻</span>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell auth-shell--console">
      <section className="auth-card">
        <button
          className="auth-back"
          type="button"
          onClick={() => {
            setShowForm(false)
            setError(null)
            setMessage(null)
          }}
        >
          ← Choose profile
        </button>
        <span className="wordmark">clarity<span>.</span></span>
        <p className="eyebrow">Your progress, wherever you practice</p>
        <h1>{mode === 'sign-in' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p className="auth-intro">
          Sign in to keep your paths, quiz history, and review queue connected to your account.
        </p>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'sign-up' && (
            <label className="field">
              <span>Display name <small>(optional)</small></span>
              <input
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="auth-message auth-message--error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="button button--full" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          className="link-button auth-switch"
          type="button"
          onClick={() => {
            setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in')
            setError(null)
            setMessage(null)
          }}
        >
          {mode === 'sign-in' ? 'New to Clarity? Create an account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  )
}
