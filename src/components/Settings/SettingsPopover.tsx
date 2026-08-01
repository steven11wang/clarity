import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Contrast, KeyRound, Settings, TrendingUp, UserRound } from 'lucide-react'

import { useAuthProfile } from '../../auth/AuthContext.tsx'
import { AVATARS } from '../../auth/profileShortcuts.ts'
import './settings.css'

type SettingsPopoverProps = {
  onScoreUpdate: () => void
}

export function SettingsPopover({ onScoreUpdate }: SettingsPopoverProps) {
  const {
    email,
    displayName,
    isLocal,
    signOut,
    profileId,
    avatarId = 'orbit',
    updateAvatar,
    hasProfilePin = false,
    setProfilePin,
    clearProfilePin,
  } = useAuthProfile()
  const [open, setOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingPin, setEditingPin] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [savingPin, setSavingPin] = useState(false)
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

  function resetPinForm() {
    setEditingPin(false)
    setNewPin('')
    setConfirmPin('')
    setPinError(null)
  }

  async function savePin() {
    if (!/^\d{4,8}$/.test(newPin)) {
      setPinError('Use a 4–8 digit PIN.')
      return
    }
    if (newPin !== confirmPin) {
      setPinError('Those PINs don’t match.')
      return
    }
    if (!setProfilePin) return

    setSavingPin(true)
    setPinError(null)
    try {
      await setProfilePin(newPin)
      resetPinForm()
    } catch (error) {
      setPinError(error instanceof Error ? error.message : 'Clarity couldn’t save that PIN.')
    } finally {
      setSavingPin(false)
    }
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
        <Settings size={19} strokeWidth={1.5} absoluteStrokeWidth />
      </button>

      {open && (
        <section className="settings-popover__panel" id={panelId} aria-label="Settings">
          <div className="settings-popover__identity">
            <span className="settings-popover__eyebrow">Account</span>
            <strong title={accountLabel}>{accountLabel}</strong>
            <small>{isLocal ? 'Progress saved on this device' : 'Progress synced to your account'}</small>
          </div>

          <div className="settings-popover__rows">
            <button className="settings-popover__row settings-popover__row--button" type="button" onClick={() => setEditingProfile((value) => !value)}>
              <span className="settings-popover__icon" aria-hidden="true"><UserRound size={17} strokeWidth={1.5} absoluteStrokeWidth /></span>
              <span>
                <strong>Profile</strong>
                <small>{editingProfile ? 'Choose avatar' : displayName}</small>
              </span>
              <span className="settings-popover__chevron" aria-hidden="true"><ChevronRight size={15} strokeWidth={1.5} absoluteStrokeWidth /></span>
            </button>
            {editingProfile && updateAvatar && <div className="settings-avatar-picker" aria-label="Avatar choices">{AVATARS.map((avatar) => <button key={avatar.id} type="button" aria-pressed={avatarId === avatar.id} aria-label={`Use ${avatar.label} avatar`} onClick={() => { void updateAvatar(avatar.id); setEditingProfile(false) }}>{avatar.glyph}</button>)}</div>}

            {profileId && setProfilePin && clearProfilePin && (
              <>
                <button
                  className="settings-popover__row settings-popover__row--button"
                  type="button"
                  onClick={() => {
                    setEditingPin((value) => !value)
                    setPinError(null)
                  }}
                >
                  <span className="settings-popover__icon" aria-hidden="true"><KeyRound size={17} strokeWidth={1.5} absoluteStrokeWidth /></span>
                  <span>
                    <strong>Profile PIN</strong>
                    <small>{hasProfilePin ? 'PIN enabled · stays on this device' : 'No PIN · device only'}</small>
                  </span>
                  <span className="settings-popover__chevron" aria-hidden="true"><ChevronRight size={15} strokeWidth={1.5} absoluteStrokeWidth /></span>
                </button>
                {editingPin && (
                  <div className="settings-pin-form">
                    <p>This PIN stays on this device.</p>
                    <label>
                      <span>{hasProfilePin ? 'New PIN' : 'PIN'}</span>
                      <input
                        aria-label="New profile PIN"
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        value={newPin}
                        onChange={(event) => setNewPin(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Confirm PIN</span>
                      <input
                        aria-label="Confirm profile PIN"
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        value={confirmPin}
                        onChange={(event) => setConfirmPin(event.target.value)}
                      />
                    </label>
                    {pinError && <p className="settings-pin-form__error" role="alert">{pinError}</p>}
                    <div className="settings-pin-form__actions">
                      {hasProfilePin && (
                        <button
                          className="settings-pin-form__remove"
                          type="button"
                          onClick={() => {
                            clearProfilePin()
                            resetPinForm()
                          }}
                        >
                          Remove PIN
                        </button>
                      )}
                      <button type="button" onClick={resetPinForm}>Cancel</button>
                      <button type="button" data-profile-pin-save disabled={savingPin} onClick={() => { void savePin() }}>
                        {savingPin ? 'Saving…' : hasProfilePin ? 'Change PIN' : 'Set PIN'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              className="settings-popover__row settings-popover__row--button"
              type="button"
              onClick={() => closeAnd(onScoreUpdate)}
            >
              <span className="settings-popover__icon" aria-hidden="true"><TrendingUp size={17} strokeWidth={1.5} absoluteStrokeWidth /></span>
              <span>
                <strong>Score update</strong>
                <small>Refresh your starting score</small>
              </span>
              <span className="settings-popover__chevron" aria-hidden="true"><ChevronRight size={15} strokeWidth={1.5} absoluteStrokeWidth /></span>
            </button>

            <div className="settings-popover__row">
              <span className="settings-popover__icon" aria-hidden="true"><Contrast size={17} strokeWidth={1.5} absoluteStrokeWidth /></span>
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
