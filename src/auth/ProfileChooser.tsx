import { useState } from 'react'

import { avatarFor, type ProfileShortcut } from './profileShortcuts.ts'

export function ProfileChooser({ profiles, onChoose, onAddUser }: {
  profiles: ProfileShortcut[]
  onChoose: (profile: ProfileShortcut) => void
  onAddUser: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  return (
    <main className="profile-gate">
      <div className="profile-gate__scanlines" aria-hidden="true" />
      <div className="profile-gate__motes" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
      <section className="profile-gate__content" aria-labelledby="profile-gate-title">
        <h1 id="profile-gate-title">Welcome back to Clarity</h1><p>Who’s studying?</p>
        <div className="profile-gate__profiles">
          {profiles.map((profile) => <div className="profile-gate__learner" key={profile.id}>
            <button className="profile-gate__avatar" type="button" aria-label={`Continue as ${profile.displayName}`} onClick={() => { setError(null); onChoose(profile) }}><span>{avatarFor(profile.avatarId).glyph}</span></button>
            <strong>{profile.displayName}</strong>
          </div>)}
          <button className="profile-gate__add" type="button" aria-label="Add another user" onClick={onAddUser}><span>+</span><strong>Add User</strong></button>
        </div>
        {error && <p role="alert">{error}</p>}
        <span className="profile-gate__power" aria-hidden="true">↻</span>
      </section>
    </main>
  )
}
