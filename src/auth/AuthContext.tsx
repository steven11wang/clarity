import { createContext, useContext, type ReactNode } from 'react'

export type AuthProfileContextValue = {
  email: string | null
  displayName: string
  isLocal: boolean
  signOut: (() => Promise<void>) | null
}

const fallback: AuthProfileContextValue = {
  email: null,
  displayName: 'Account',
  isLocal: false,
  signOut: null,
}

const AuthProfileContext = createContext<AuthProfileContextValue>(fallback)

export function AuthProfileProvider({
  value,
  children,
}: {
  value: AuthProfileContextValue
  children: ReactNode
}) {
  return <AuthProfileContext.Provider value={value}>{children}</AuthProfileContext.Provider>
}

export function useAuthProfile() {
  return useContext(AuthProfileContext)
}
