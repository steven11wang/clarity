import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'

import { ConsoleAudioProvider } from '../audio/ConsoleAudioProvider.tsx'
import { AuthProfileProvider } from './AuthContext.tsx'
import { ProfileChooser } from './ProfileChooser.tsx'
import { AVATARS, listProfileShortcuts, type AvatarId, type ProfileShortcut, upsertProfileShortcut } from './profileShortcuts.ts'
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

  useEffect(() => {
    if (!user) return
    upsertProfileShortcut({
      id: user.id,
      email: user.email ?? '',
      displayName: typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : user.email?.split('@')[0] ?? 'Account',
      avatarId: typeof user.user_metadata?.avatar_id === 'string' ? user.user_metadata.avatar_id as AvatarId : 'orbit',
    })
  }, [user])

  if (!isSupabaseConfigured) {
    return (
      <>
        <ConsoleAudioProvider scene="auth" />
        <LocalProfileGate>{children}</LocalProfileGate>
      </>
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
    return (
      <>
        <ConsoleAudioProvider scene="auth" />
        <SignIn />
      </>
    )
  }

  return (
    <>
      {syncError && (
        <div className="sync-warning" role="status">
          Saved on this device. Cloud sync will retry after your next change. {syncError}
        </div>
      )}
      <AuthProfileProvider
        value={{
          email: user.email ?? null,
          displayName: typeof user.user_metadata?.display_name === 'string'
            ? user.user_metadata.display_name
            : user.email?.split('@')[0] ?? 'Account',
          isLocal: false,
          signOut: async () => {
            await supabase!.auth.signOut()
          },
          openAccount: () => {
            void supabase!.auth.signOut()
          },
        }}
      >
        {children}
      </AuthProfileProvider>
    </>
  )
}

export function LocalProfileGate({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ProfileShortcut | null>(() => {
    const activeId = window.sessionStorage.getItem('clarity-active-profile')
    return listProfileShortcuts().find((profile) => profile.id === activeId) ?? null
  })
  const [showSignUp, setShowSignUp] = useState(false)

  function openAccount() {
    window.sessionStorage.removeItem('clarity-active-profile')
    setSelected(null)
  }

  if (showSignUp) {
    return <SignIn initialMode="sign-up" onLocalProfileCreated={(profile) => { setSelected(profile); setShowSignUp(false) }} />
  }

  if (selected) {
    return (
      <>
        <AuthProfileProvider
          value={{
            email: null,
            displayName: selected.displayName,
            isLocal: true,
            signOut: null,
            openAccount,
          }}
        >
          {children}
        </AuthProfileProvider>
      </>
    )
  }

  return <ProfileChooser profiles={listProfileShortcuts()} onAddUser={() => setShowSignUp(true)} onChoose={(profile) => {
    window.sessionStorage.setItem('clarity-active-profile', profile.id)
    setSelected(profile)
  }} />
}

export function SignIn({ initialMode = 'sign-in', onLocalProfileCreated }: { initialMode?: 'sign-in' | 'sign-up'; onLocalProfileCreated?: (profile: ProfileShortcut) => void } = {}) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode)
  const [showForm, setShowForm] = useState(initialMode === 'sign-up')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarId, setAvatarId] = useState<AvatarId | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) {
      if (mode === 'sign-up' && avatarId) {
        const name = displayName.trim() || email.split('@')[0] || 'Learner'
        const profile = upsertProfileShortcut({ id: `local-${email || name}`, email, displayName: name, avatarId })
        if (onLocalProfileCreated) onLocalProfileCreated(profile)
        else setShowForm(false)
      }
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)

    const result =
      mode === 'sign-up'
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { display_name: displayName.trim() || undefined, avatar_id: avatarId ?? 'orbit' } },
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
              data-ui-sound="true"
              data-ui-sound-hover="hover"
              data-ui-sound-click="open"
            >
              <span>+</span>
              <strong>Add User</strong>
            </button>
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
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="select"
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
            <>
              <label className="field"><span>Display name <small>(optional)</small></span><input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
              <fieldset className="avatar-picker"><legend>Choose your avatar</legend><div>{AVATARS.map((avatar) => <button key={avatar.id} type="button" aria-pressed={avatarId === avatar.id} aria-label={avatar.label} onClick={() => setAvatarId(avatar.id)}>{avatar.glyph}</button>)}</div></fieldset>
            </>
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
          <button
            className="button button--full"
            type="submit"
            disabled={busy || (mode === 'sign-up' && !avatarId)}
            data-ui-sound="true"
            data-ui-sound-hover="hover"
            data-ui-sound-click="select"
          >
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
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="open"
        >
          {mode === 'sign-in' ? 'New to Clarity? Create an account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  )
}
