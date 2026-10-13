export const PROFILE_SHORTCUTS_KEY = 'clarity-profile-shortcuts-v1'

/** Pixel pets in the spirit of Claude's orange critter. Art lives in public/avatars. */
export const AVATARS = [
  { id: 'clawd', label: 'Clawd' },
  { id: 'scholar', label: 'Scholar' },
  { id: 'specs', label: 'Specs' },
  { id: 'beats', label: 'Beats' },
  { id: 'nap', label: 'Nap' },
  { id: 'spark', label: 'Spark' },
  { id: 'reader', label: 'Reader' },
  { id: 'streak', label: 'Streak' },
] as const

export type AvatarId = (typeof AVATARS)[number]['id']

/** Earlier builds saved these glyph ids; keep them pointing at a pet. */
const LEGACY_AVATARS: Record<string, AvatarId> = { orbit: 'clawd', wave: 'beats' }

export function avatarSrc(id: string | undefined) {
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/'
  return `${base}avatars/${avatarFor(id).id}.svg`
}

export type ProfileShortcut = {
  id: string
  email: string
  displayName: string
  avatarId: AvatarId
  pin?: {
    salt: string
    digest: string
  }
}

export function avatarFor(id: string | undefined) {
  const resolved = id ? LEGACY_AVATARS[id] ?? id : undefined
  return AVATARS.find((avatar) => avatar.id === resolved) ?? AVATARS[0]
}

export function listProfileShortcuts(): ProfileShortcut[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(PROFILE_SHORTCUTS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.flatMap((value): ProfileShortcut[] => {
      if (!value || typeof value !== 'object') return []
      const item = value as Record<string, unknown>
      if (typeof item.id !== 'string' || typeof item.email !== 'string' || typeof item.displayName !== 'string') return []
      const savedPin = item.pin && typeof item.pin === 'object'
        ? item.pin as Record<string, unknown>
        : null
      const pin = savedPin
        && typeof savedPin.salt === 'string'
        && savedPin.salt.length > 0
        && typeof savedPin.digest === 'string'
        && savedPin.digest.length > 0
        ? { salt: savedPin.salt, digest: savedPin.digest }
        : undefined
      return [{
        id: item.id,
        email: item.email,
        displayName: item.displayName,
        avatarId: avatarFor(typeof item.avatarId === 'string' ? item.avatarId : undefined).id,
        ...(pin ? { pin } : {}),
      }]
    })
  } catch {
    return []
  }
}

export function upsertProfileShortcut(profile: ProfileShortcut) {
  const profiles = listProfileShortcuts()
  const existing = profiles.find((item) => item.id === profile.id)
  const pin = profile.pin ?? existing?.pin
  const normalized: ProfileShortcut = {
    ...profile,
    avatarId: avatarFor(profile.avatarId).id,
    ...(pin ? { pin } : {}),
  }
  const uniqueProfiles = profiles.filter((item) => item.id !== normalized.id)
  window.localStorage.setItem(PROFILE_SHORTCUTS_KEY, JSON.stringify([...uniqueProfiles, normalized]))
  return normalized
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function digestPin(salt: string, pin: string) {
  const input = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
  return bytesToBase64(new Uint8Array(digest))
}

export async function setProfilePin(id: string, pin: string) {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new Error('Use a 4–8 digit PIN.')
  }
  const profile = listProfileShortcuts().find((item) => item.id === id)
  if (!profile) throw new Error('Profile shortcut not found.')

  const saltBytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const salt = bytesToBase64(saltBytes)
  return upsertProfileShortcut({
    ...profile,
    pin: { salt, digest: await digestPin(salt, pin) },
  })
}

export function clearProfilePin(id: string) {
  const profiles = listProfileShortcuts()
  const profile = profiles.find((item) => item.id === id)
  if (!profile) throw new Error('Profile shortcut not found.')

  const { pin: _pin, ...unprotectedProfile } = profile
  const remaining = profiles.filter((item) => item.id !== id)
  window.localStorage.setItem(PROFILE_SHORTCUTS_KEY, JSON.stringify([...remaining, unprotectedProfile]))
  return unprotectedProfile
}

export async function verifyProfilePin(profile: ProfileShortcut, pin: string) {
  if (!profile.pin) return true
  const candidate = await digestPin(profile.pin.salt, pin)
  if (candidate.length !== profile.pin.digest.length) return false

  let difference = 0
  for (let index = 0; index < candidate.length; index += 1) {
    difference |= candidate.charCodeAt(index) ^ profile.pin.digest.charCodeAt(index)
  }
  return difference === 0
}
