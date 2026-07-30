export const PROFILE_SHORTCUTS_KEY = 'clarity-profile-shortcuts-v1'

export const AVATARS = [
  { id: 'orbit', label: 'Orbit', glyph: '◒' },
  { id: 'spark', label: 'Spark', glyph: '✦' },
  { id: 'wave', label: 'Wave', glyph: '≈' },
] as const

export type AvatarId = (typeof AVATARS)[number]['id']

export type ProfileShortcut = {
  id: string
  email: string
  displayName: string
  avatarId: AvatarId
}

export function avatarFor(id: string | undefined) {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0]
}

export function listProfileShortcuts(): ProfileShortcut[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(PROFILE_SHORTCUTS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap((value): ProfileShortcut[] => {
      if (!value || typeof value !== 'object') return []
      const item = value as Record<string, unknown>
      if (typeof item.id !== 'string' || typeof item.email !== 'string' || typeof item.displayName !== 'string') return []
      return [{ id: item.id, email: item.email, displayName: item.displayName, avatarId: avatarFor(typeof item.avatarId === 'string' ? item.avatarId : undefined).id }]
    })
  } catch {
    return []
  }
}

export function upsertProfileShortcut(profile: ProfileShortcut) {
  const normalized = { ...profile, avatarId: avatarFor(profile.avatarId).id }
  const profiles = listProfileShortcuts().filter((item) => item.id !== normalized.id)
  window.localStorage.setItem(PROFILE_SHORTCUTS_KEY, JSON.stringify([...profiles, normalized]))
  return normalized
}
