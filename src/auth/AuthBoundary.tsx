import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'

import { ConsoleAudioProvider } from '../audio/ConsoleAudioProvider.tsx'
import { AuthProfileProvider } from './AuthContext.tsx'
import { ProfileChooser } from './ProfileChooser.tsx'
import {
  AVATARS,
  clearProfilePin,
  listProfileShortcuts,
  setProfilePin,
  type AvatarId,
  type ProfileShortcut,
  upsertProfileShortcut,
} from './profileShortcuts.ts'
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
  const [unlockedUserId, setUnlockedUserId] = useState<string | null>(null)
  const [profileRevision, setProfileRevision] = useState(0)
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
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setChecking(false)
      if (event === 'SIGNED_IN' && session?.user) setUnlockedUserId(session.user.id)
      if (!session) {
        syncedUserId.current = null
        setUnlockedUserId(null)
      }
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

  if (!user || unlockedUserId !== user.id) {
    return (
      <>
        <ConsoleAudioProvider scene="auth" />
        <AccountChooser
          activeUserId={user?.id ?? null}
          onUnlock={(profile) => setUnlockedUserId(profile.id)}
        />
      </>
    )
  }

  void profileRevision
  const activeShortcut = listProfileShortcuts().find((profile) => profile.id === user.id)

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
            setUnlockedUserId(null)
          },
          profileId: user.id,
          avatarId: typeof user.user_metadata?.avatar_id === 'string' ? user.user_metadata.avatar_id : 'orbit',
          updateAvatar: async (avatarId) => {
            await supabase!.auth.updateUser({ data: { avatar_id: avatarId } })
            upsertProfileShortcut({ id: user.id, email: user.email ?? '', displayName: typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : user.email?.split('@')[0] ?? 'Account', avatarId: avatarId as AvatarId })
            setUser((current) => current ? { ...current, user_metadata: { ...current.user_metadata, avatar_id: avatarId } } : current)
          },
          hasProfilePin: Boolean(activeShortcut?.pin),
          setProfilePin: async (pin) => {
            await setProfilePin(user.id, pin)
            setProfileRevision((revision) => revision + 1)
          },
          clearProfilePin: () => {
            clearProfilePin(user.id)
            setProfileRevision((revision) => revision + 1)
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
    return <SignIn
      initialMode="sign-up"
      onChooseProfile={() => setShowSignUp(false)}
      onLocalProfileCreated={(profile) => { setSelected(profile); setShowSignUp(false) }}
    />
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
            profileId: selected.id,
            avatarId: selected.avatarId,
            updateAvatar: async (avatarId) => {
              const updated = upsertProfileShortcut({ ...selected, avatarId: avatarId as AvatarId })
              setSelected(updated)
            },
            hasProfilePin: Boolean(selected.pin),
            setProfilePin: async (pin) => {
              setSelected(await setProfilePin(selected.id, pin))
            },
            clearProfilePin: () => {
              setSelected(clearProfilePin(selected.id))
            },
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

export function AccountChooser({
  activeUserId = null,
  onUnlock = () => {},
}: {
  activeUserId?: string | null
  onUnlock?: (profile: ProfileShortcut) => void
} = {}) {
  const [selected, setSelected] = useState<ProfileShortcut | null>(null)
  const [creating, setCreating] = useState(false)
  if (creating) return <SignIn initialMode="sign-up" onChooseProfile={() => setCreating(false)} />
  if (selected) return <SignIn initialEmail={selected.email} onChooseProfile={() => setSelected(null)} />
  return <ProfileChooser profiles={listProfileShortcuts()} onAddUser={() => {
    if (activeUserId && supabase) {
      void supabase.auth.signOut().finally(() => setCreating(true))
    } else {
      setCreating(true)
    }
  }} onChoose={(profile) => {
    if (profile.id === activeUserId) {
      onUnlock(profile)
    } else {
      setSelected(profile)
    }
  }} />
}

export function SignIn({
  initialMode = 'sign-in',
  initialEmail = '',
  onChooseProfile,
  onLocalProfileCreated,
}: {
  initialMode?: 'sign-in' | 'sign-up'
  initialEmail?: string
  onChooseProfile?: () => void
  onLocalProfileCreated?: (profile: ProfileShortcut) => void
} = {}) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode)
  const [showForm, setShowForm] = useState(initialMode === 'sign-up' || initialEmail.length > 0)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarId, setAvatarId] = useState<AvatarId>('orbit')
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) {
      if (mode === 'sign-up') {
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
            if (onChooseProfile) {
              onChooseProfile()
              return
            }
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
              <div className="avatar-picker avatar-picker--hero"><button className="avatar-picker__current" type="button" aria-label="Choose avatar" aria-expanded={avatarPickerOpen} onClick={() => setAvatarPickerOpen((open) => !open)}>{AVATARS.find((avatar) => avatar.id === avatarId)?.glyph}</button><span>Choose your avatar</span>{avatarPickerOpen && <div className="avatar-picker__options">{AVATARS.map((avatar) => <button key={avatar.id} type="button" aria-pressed={avatarId === avatar.id} aria-label={avatar.label} onClick={() => { setAvatarId(avatar.id); setAvatarPickerOpen(false) }}>{avatar.glyph}</button>)}</div>}</div>
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
            disabled={busy}
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
