import { useState, type FormEvent } from 'react'

import { avatarFor, verifyProfilePin, type ProfileShortcut } from './profileShortcuts.ts'

export function ProfileChooser({ profiles, onChoose, onAddUser }: {
  profiles: ProfileShortcut[]
  onChoose: (profile: ProfileShortcut) => void
  onAddUser: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pinProfile, setPinProfile] = useState<ProfileShortcut | null>(null)
  const [pin, setPin] = useState('')
  const [checkingPin, setCheckingPin] = useState(false)

  function choose(profile: ProfileShortcut) {
    setError(null)
    if (profile.pin) {
      setPin('')
      setPinProfile(profile)
      return
    }
    onChoose(profile)
  }

  async function submitPin(event: FormEvent) {
    event.preventDefault()
    if (!pinProfile) return
    setCheckingPin(true)
    setError(null)
    try {
      if (await verifyProfilePin(pinProfile, pin)) {
        const chosen = pinProfile
        setPinProfile(null)
        setPin('')
        onChoose(chosen)
      } else {
        setError('That PIN doesn’t match. Try again.')
      }
    } catch {
      setError('Clarity couldn’t check that PIN on this device.')
    } finally {
      setCheckingPin(false)
    }
  }

  return (
    <main className="profile-gate">
      <div className="profile-gate__scanlines" aria-hidden="true" />
      <div className="profile-gate__motes" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      <section className="profile-gate__content" aria-labelledby="profile-gate-title">
        <h1 id="profile-gate-title">Welcome back to Clarity</h1><p>Who’s studying?</p>
        <div className="profile-gate__profiles">
          {profiles.map((profile) => <div className="profile-gate__learner" key={profile.id}>
            <button className="profile-gate__avatar" type="button" aria-label={`Continue as ${profile.displayName}`} onClick={() => choose(profile)}><span>{avatarFor(profile.avatarId).glyph}</span></button>
            <strong>{profile.displayName}</strong>
          </div>)}
          <button className="profile-gate__add" type="button" aria-label="Add another user" onClick={onAddUser}><span>+</span><strong>Add User</strong></button>
        </div>
        {pinProfile && (
          <form className="profile-gate__pin" onSubmit={submitPin}>
            <label htmlFor="profile-pin">Enter {pinProfile.displayName}’s PIN</label>
            <input
              id="profile-pin"
              aria-label={`PIN for ${pinProfile.displayName}`}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              autoFocus
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
            <div>
              <button type="button" onClick={() => { setPinProfile(null); setPin(''); setError(null) }}>Cancel</button>
              <button type="submit" data-profile-pin-submit disabled={checkingPin || pin.length === 0}>
                {checkingPin ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <span className="profile-gate__power" aria-hidden="true">↻</span>
      </section>
    </main>
  )
}
