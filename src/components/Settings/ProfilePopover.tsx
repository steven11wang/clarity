import { useEffect, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'

import { useAuthProfile } from '../../auth/AuthContext.tsx'
import { AVATARS, avatarFor } from '../../auth/profileShortcuts.ts'
import { Avatar } from './Avatar.tsx'
import './profilePopover.css'

/** The round profile button in the header. Opens a small panel of pet pictures
 *  to pick from, with the account name and sign out underneath. */
export function ProfilePopover() {
  const { displayName, email, avatarId, updateAvatar, signOut, isLocal } = useAuthProfile()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const current = avatarFor(avatarId)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function choose(id: string) {
    if (!updateAvatar || id === current.id) return
    setSaving(id)
    try {
      await updateAvatar(id)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="profile-popover" ref={containerRef}>
      <button
        className="profile-popover__trigger"
        type="button"
        aria-label="Profile and picture"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        data-ui-sound="true"
        data-ui-sound-hover="hover"
        data-ui-sound-click="open"
      >
        <Avatar id={avatarId} size={36} />
      </button>

      {open && (
        <section className="profile-popover__panel" role="dialog" aria-label="Profile picture">
          <header className="profile-popover__who">
            <Avatar id={avatarId} size={52} />
            <span>
              <strong title={displayName}>{displayName}</strong>
              <small title={email ?? undefined}>{isLocal ? 'Saved on this device' : email}</small>
            </span>
          </header>

          <p className="profile-popover__label">Choose your picture</p>
          <div className="profile-popover__grid" role="group" aria-label="Profile pictures">
            {AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                className="profile-popover__choice"
                aria-pressed={current.id === avatar.id}
                aria-label={`Use ${avatar.label}`}
                title={avatar.label}
                disabled={saving !== null}
                onClick={() => void choose(avatar.id)}
              >
                <Avatar id={avatar.id} size={56} />
              </button>
            ))}
          </div>

          {signOut && (
            <button
              type="button"
              className="profile-popover__signout"
              onClick={() => {
                setOpen(false)
                void signOut()
              }}
            >
              <LogOut size={15} strokeWidth={1.6} absoluteStrokeWidth aria-hidden="true" />
              Sign out
            </button>
          )}
        </section>
      )}
    </div>
  )
}
