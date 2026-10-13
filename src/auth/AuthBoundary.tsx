import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'

import { ConsoleAudioProvider } from '../audio/ConsoleAudioProvider.tsx'
import { AuthProfileProvider } from './AuthContext.tsx'
import { SignInPage, UsernameStep, type SignInPageProps } from './SignInPage.tsx'
import {
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
  const [, setSyncError] = useState<string | null>(null)
  const [unlockedUserId, setUnlockedUserId] = useState<string | null>(null)
  const [profileRevision, setProfileRevision] = useState(0)
  const syncedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setSyncError(error.message)
      const restoredUser = data.session?.user ?? null
      setUser(restoredUser)
      // A persisted session means this browser already remembers the learner
      // (Supabase keeps it in localStorage) - skip straight to the dashboard
      // instead of asking them to sign in again.
      if (restoredUser) setUnlockedUserId(restoredUser.id)
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
        <SignInPage
          initialError={extractUrlAuthError()}
          onSuccess={(profile) => setUnlockedUserId(profile.id)}
        />
      </>
    )
  }

  // First sign-in: ask for a public username (defaults to the email name)
  // before the dashboard. Stored on the account, so it is asked only once.
  const savedName = user.user_metadata?.display_name
  if (typeof savedName !== 'string' || !savedName.trim()) {
    return (
      <>
        <ConsoleAudioProvider scene="auth" />
        <UsernameStep
          email={user.email ?? ''}
          onSubmit={async (username) => {
            const { data, error } = await supabase!.auth.updateUser({ data: { display_name: username } })
            if (error) return error.message
            upsertProfileShortcut({
              id: user.id,
              email: user.email ?? '',
              displayName: username,
              avatarId: typeof user.user_metadata?.avatar_id === 'string' ? user.user_metadata.avatar_id as AvatarId : 'orbit',
            })
            setUser(data.user ?? { ...user, user_metadata: { ...user.user_metadata, display_name: username } })
            return null
          }}
        />
      </>
    )
  }

  void profileRevision
  const activeShortcut = listProfileShortcuts().find((profile) => profile.id === user.id)

  return (
    <>
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

export function extractUrlAuthError(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const searchParams = new URLSearchParams(window.location.search)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const hashParams = new URLSearchParams(hash)

    const error = searchParams.get('error') || hashParams.get('error')
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')
    const errorCode = searchParams.get('error_code') || hashParams.get('error_code')
    const msg = searchParams.get('error_msg') || hashParams.get('error_msg') || searchParams.get('message')

    if (error || errorDescription || errorCode || msg) {
      const rawDesc = errorDescription || msg || ''
      const desc = rawDesc ? decodeURIComponent(rawDesc.replace(/\+/g, ' ')) : null

      // Clean the query/hash from the address bar without reloading
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, document.title, cleanUrl)

      if (desc) {
        if (error && error !== 'server_error') return `${desc} (${error})`
        return desc
      }
      if (error === 'server_error') {
        return 'Google sign-in could not be completed (server_error). Please check your Google OAuth credentials in Supabase.'
      }
      return error || 'Authentication failed.'
    }
  } catch {
    // Ignore URL parsing errors
  }
  return null
}

// Offline mode remembers the learner in localStorage so a return visit lands
// on the dashboard (satclarity.com's landing page checks the same key).
const ACTIVE_PROFILE_KEY = 'clarity-active-profile'

function readActiveProfileId() {
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY)
  } catch {
    return null
  }
}

function saveActiveProfileId(id: string) {
  try {
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, id)
  } catch {
    // Storage blocked: the learner just signs in again next visit.
  }
}

function clearActiveProfileId() {
  try {
    window.localStorage.removeItem(ACTIVE_PROFILE_KEY)
  } catch {
    // ignore
  }
}

export function LocalProfileGate({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ProfileShortcut | null>(() => {
    const activeId = readActiveProfileId()
    return listProfileShortcuts().find((profile) => profile.id === activeId) ?? null
  })
  const [authError, setAuthError] = useState<string | null>(() => extractUrlAuthError())

  function openAccount() {
    clearActiveProfileId()
    setSelected(null)
  }

  if (selected) {
    return (
      <AuthProfileProvider
        value={{
          email: selected.email || null,
          displayName: selected.displayName,
          isLocal: true,
          signOut: async () => {
            openAccount()
          },
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
    )
  }

  return (
    <SignInPage
      initialError={authError}
      onSuccess={(profile) => {
        saveActiveProfileId(profile.id)
        setAuthError(null)
        setSelected(profile)
      }}
    />
  )
}

/** Backwards-compatible aliases for tests and external consumers */
export function AccountChooser({
  activeUserId = null,
  onUnlock = () => {},
}: {
  activeUserId?: string | null
  onUnlock?: (profile: ProfileShortcut) => void
} = {}) {
  void activeUserId
  return <SignInPage onSuccess={onUnlock} />
}

export function SignIn(props: SignInPageProps & { initialMode?: string; onChooseProfile?: () => void; onLocalProfileCreated?: (p: ProfileShortcut) => void }) {
  return (
    <SignInPage
      initialEmail={props.initialEmail}
      initialError={props.initialError}
      onSuccess={(profile) => {
        if (props.onLocalProfileCreated) props.onLocalProfileCreated(profile)
        if (props.onSuccess) props.onSuccess(profile)
      }}
    />
  )
}
