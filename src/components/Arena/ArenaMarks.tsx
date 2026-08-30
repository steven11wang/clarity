import { useState } from 'react'

import { AVATAR_GLYPHS, DIVISIONS, TIERS } from '../../arena/config.ts'
import { tierColor, type Rank } from '../../arena/model.ts'
import { assetPath } from '../../lib/assetPath.ts'

// The crest is the rank, drawn: a shield tinted by tier, the division numeral
// inside it, and three stars underneath for the rungs within that division.
export function RankCrest({
  rank,
  size = 96,
  showStars = true,
}: {
  rank: Rank
  size?: number
  showStars?: boolean
}) {
  const color = tierColor(rank.tier)
  const label = `${TIERS[rank.tier]} ${DIVISIONS[rank.division]}`

  return (
    <span className="arena-crest" style={{ '--crest-color': color } as React.CSSProperties}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
        <defs>
          <linearGradient id={`crest-${rank.tier}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <path
          d="M50 6 88 20v30c0 22-16 36-38 44C28 86 12 72 12 50V20z"
          fill={`url(#crest-${rank.tier})`}
          stroke={color}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M50 20 74 29v20c0 14-10 23-24 29-14-6-24-15-24-29V29z"
          fill="rgba(4,6,14,0.55)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.2"
        />
        <text
          x="50"
          y="59"
          textAnchor="middle"
          fill="#f3f6fc"
          fontSize="22"
          fontWeight="600"
          letterSpacing="1"
        >
          {DIVISIONS[rank.division]}
        </text>
      </svg>
      {showStars && (
        <span className="arena-crest__stars" aria-label={`${rank.stars} of 3 stars`}>
          {Array.from({ length: 3 }, (_, index) => (
            <i key={index} className={index < rank.stars ? 'is-filled' : undefined} aria-hidden="true">
              ★
            </i>
          ))}
        </span>
      )}
    </span>
  )
}

// Every avatar is optional art. If the AVIF is missing the glyph stands in, so
// a battle never renders a broken image where a face should be.
export function FighterAvatar({
  avatarId,
  name,
  side,
  size = 76,
}: {
  avatarId: string
  name: string
  side: 'mine' | 'rival'
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const glyph = AVATAR_GLYPHS[avatarId] ?? name.slice(0, 1).toUpperCase()

  return (
    <span className={`arena-fighter arena-fighter--${side}`} style={{ width: size, height: size }}>
      {failed ? (
        <span className="arena-fighter__glyph" aria-hidden="true">
          {glyph}
        </span>
      ) : (
        <img src={assetPath(`art/arena/avatar-${avatarId}.avif`)} alt="" onError={() => setFailed(true)} />
      )}
    </span>
  )
}

// A single bar split between the two scores. It reads at a glance from across
// the room, which the numbers beside it do not.
export function EnergyBar({
  share,
  minePoints,
  rivalPoints,
}: {
  share: number
  minePoints: number
  rivalPoints: number
}) {
  const percent = Math.round(Math.max(0.06, Math.min(0.94, share)) * 100)
  return (
    <div
      className="arena-energy"
      role="img"
      aria-label={`You ${minePoints} points, opponent ${rivalPoints} points`}
    >
      <span className="arena-energy__mine" style={{ width: `${percent}%` }} />
      <span className="arena-energy__rival" style={{ width: `${100 - percent}%` }} />
      <i className="arena-energy__seam" style={{ left: `${percent}%` }} aria-hidden="true" />
    </div>
  )
}
