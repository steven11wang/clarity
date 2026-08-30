import { useEffect, useState } from 'react'

import { assetPath } from '../../lib/assetPath.ts'

// The wait, made legible. Three things can be true here - you are in a live
// queue, you are holding an invite open, or Realtime is unavailable and a
// training opponent is warming up - and the copy says which.
export function ArenaSearching({
  kind,
  code,
  opponentsSeen,
  timeoutMs,
  live,
  onCancel,
}: {
  kind: 'queue' | 'invite'
  code?: string
  opponentsSeen: number
  timeoutMs: number
  live: boolean
  onCancel: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const [copied, setCopied] = useState(false)

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
          ? 'Waiting for your friend'
          : live
            ? 'Scanning the queue…'
            : 'Warming up a training opponent'}
      </h1>
      {kind === 'invite' && code ? (
        <div className="arena-search__invite">
          <p className="arena-search__code">{code}</p>
          <button
            className="arena-button"
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(inviteLink)
              setCopied(true)
            }}
          >
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
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
