import { useEffect, useRef, useState } from 'react'

import { useAuthProfile } from '../../auth/AuthContext.tsx'
import './settings.css'

type SettingsPopoverProps = {
  onScoreUpdate: () => void
}

export function SettingsPopover({ onScoreUpdate }: SettingsPopoverProps) {
  const { email, displayName, isLocal, signOut } = useAuthProfile()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelId = 'clarity-settings-popover'
  const accountLabel = isLocal ? `${displayName} · local profile` : email ?? displayName

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function closeAnd(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div className="settings-popover" ref={containerRef}>
      <button
        className="settings-popover__trigger"
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        data-ui-sound="true"
        data-ui-sound-hover="hover"
        data-ui-sound-click="open"
      >
        ⚙
      </button>

      {open && (
        <section className="settings-popover__panel" id={panelId} aria-label="Settings">
          <div className="settings-popover__identity">
            <span className="settings-popover__eyebrow">Account</span>
            <strong title={accountLabel}>{accountLabel}</strong>
            <small>{isLocal ? 'Progress saved on this device' : 'Progress synced to your account'}</small>
          </div>

          <div className="settings-popover__rows">
            <div className="settings-popover__row">
              <span className="settings-popover__icon" aria-hidden="true">◎</span>
              <span>
                <strong>Profile</strong>
                <small>{displayName}</small>
              </span>
            </div>

            <button
              className="settings-popover__row settings-popover__row--button"
              type="button"
              onClick={() => closeAnd(onScoreUpdate)}
            >
              <span className="settings-popover__icon" aria-hidden="true">↗</span>
              <span>
                <strong>Score update</strong>
                <small>Refresh your starting score</small>
              </span>
              <span className="settings-popover__chevron" aria-hidden="true">›</span>
            </button>

            <div className="settings-popover__row">
              <span className="settings-popover__icon" aria-hidden="true">◐</span>
              <span>
                <strong>Appearance</strong>
                <small>Dark mode</small>
              </span>
              <span className="settings-popover__status">Active</span>
            </div>
          </div>

          {!isLocal && signOut && (
            <button
              className="settings-popover__sign-out"
              type="button"
              onClick={() => closeAnd(() => { void signOut() })}
            >
              Sign out
            </button>
          )}
        </section>
      )}
    </div>
  )
}
