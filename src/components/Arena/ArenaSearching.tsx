import { useEffect, useState } from 'react'

import { assetPath } from '../../lib/assetPath.ts'

// The wait, made legible. Three things can be true here - you are in a live
// queue, you are holding an invite open, or Realtime is unavailable and a
// training opponent is warming up - and the copy says which.
export function ArenaSearching({
  kind,
  code,
  joining = false,
  opponentsSeen,
  timeoutMs,
  live,
  onCancel,
}: {
  kind: 'queue' | 'invite'
  code?: string
  /** True when this player typed a friend's code rather than hosting. */
  joining?: boolean
  opponentsSeen: number
  timeoutMs: number
  live: boolean
  onCancel: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Date.now() - start), 250)
    return () => clearInterval(timer)
  }, [])

  const secondsLeft = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000))
  const inviteLink =
    typeof window !== 'undefined' && code
      ? `${window.location.origin}${assetPath('')}?arena=${code}`
      : ''

  return (
    <section className="arena-shell arena-search">
      <div className="arena-search__radar" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="arena-search__eyebrow">
        {kind === 'invite' ? 'Private match' : live ? 'Searching for an opponent' : 'Offline arena'}
      </p>
      <h1>
        {kind === 'invite'
          ? joining
            ? 'Connecting to your friend'
            : 'Waiting for your friend'
          : live
            ? 'Scanning the queue…'
            : 'Warming up a training opponent'}
      </h1>
      {kind === 'invite' && code ? (
        <div className="arena-search__invite">
          <p className="arena-search__code">{code}</p>
          {joining ? (
            <p className="arena-search__status">
              Your friend needs to still be on their waiting screen with this code showing.
            </p>
          ) : (
            <div className="arena-launch arena-launch--center">
              <button
                className="arena-button"
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(code)
                  setCopied('code')
                }}
              >
                {copied === 'code' ? 'Code copied' : 'Copy code'}
              </button>
              <button
                className="arena-button"
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(inviteLink)
                  setCopied('link')
                }}
              >
                {copied === 'link' ? 'Link copied' : 'Copy invite link'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="arena-search__status">
          {live
            ? opponentsSeen > 0
              ? `${opponentsSeen} other ${opponentsSeen === 1 ? 'player' : 'players'} in this queue`
              : `No one here yet. A training opponent joins in ${secondsLeft}s.`
            : 'Sign in to battle live players.'}
        </p>
      )}
      <button className="arena-button arena-button--quiet" type="button" onClick={onCancel}>
        Cancel
      </button>
    </section>
  )
}
