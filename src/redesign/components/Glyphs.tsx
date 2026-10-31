// Glyphs drawn in the notebook's own grammar: red-pen marks that draw
// themselves, the five trap signs, the writing-kit rank emblems, correction
// tape and ink. Geometry only, one 2.5–4px stroke, round caps.

import type { TrapType } from '../../types.ts'
import type { Ink } from '../game/content.ts'

const NAVY = '#17183B'
const RED = '#E5262D'

export const INK_VAR: Record<Ink, string> = {
  yellow: 'var(--yellow)',
  pink: 'var(--pink)',
  green: 'var(--green)',
  blue: 'var(--blue)',
  orange: 'var(--orange)',
  violet: 'var(--violet)',
  red: 'var(--red-soft)',
}

/** A red-pen tick or cross that draws itself when mounted. */
export function PenMark({ kind, size = 40, delay = 0 }: { kind: 'check' | 'cross'; size?: number; delay?: number }) {
  const style = { animationDelay: `${delay}ms` }
  return (
    <svg className="pen-mark" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      {kind === 'check' ? (
        <path pathLength={1} style={style} d="M7 26 L19 37 L42 9" />
      ) : (
        <>
          <path pathLength={1} style={style} d="M11 11 L37 38" />
          <path pathLength={1} style={{ animationDelay: `${delay + 160}ms` }} d="M37 10 L11 37" />
        </>
      )}
    </svg>
  )
}

export function TrapGlyph({ trap, size = 44 }: { trap: TrapType; size?: number }) {
  const s = { fill: 'none', stroke: NAVY, strokeWidth: 3.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      {trap === 'too-extreme' && (
        <>
          <path {...s} d="M8 10 H40" />
          <path {...s} d="M24 40 V14 M15 23 L24 14 L33 23" />
        </>
      )}
      {trap === 'half-right' && (
        <>
          <circle {...s} cx="24" cy="24" r="15" />
          <path d="M24 9 A15 15 0 0 0 24 39Z" fill={NAVY} />
        </>
      )}
      {trap === 'true-but-irrelevant' && (
        <>
          <circle {...s} cx="30" cy="20" r="9" />
          <circle cx="30" cy="20" r="2.6" fill={NAVY} />
          <path {...s} d="M6 40 L26 34 M20 30 L27 34 L22 40" />
        </>
      )}
      {trap === 'out-of-scope' && (
        <>
          <rect {...s} x="7" y="13" width="22" height="22" rx="3" />
          <circle cx="38" cy="12" r="4.4" fill={NAVY} />
        </>
      )}
      {trap === 'opposite' && (
        <>
          <path {...s} d="M6 17 H34 M27 10 L34 17 L27 24" />
          <path {...s} d="M42 31 H14 M21 24 L14 31 L21 38" />
        </>
      )}
    </svg>
  )
}

export function StampGlyph({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <circle cx="24" cy="24" r="17" fill="none" stroke={RED} strokeWidth="3.4" />
      <circle cx="24" cy="24" r="12" fill="none" stroke={RED} strokeWidth="1.6" />
      <path d="M16 24.5 L21.5 30 L32 18" fill="none" stroke={RED} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SkillGlyph({ size = 44 }: { size?: number }) {
  // a highlighter, cap off, mid-swipe
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path d="M8 40 H30" stroke={NAVY} strokeWidth="5" strokeLinecap="round" opacity=".3" />
      <g transform="rotate(-38 26 22)" stroke={NAVY} strokeWidth="3" strokeLinejoin="round">
        <rect x="18" y="4" width="14" height="26" rx="3" fill="#FBFCFF" />
        <path d="M19 30 H31 L28 38 H22Z" fill={NAVY} />
        <path d="M18 12 H32" />
      </g>
    </svg>
  )
}

/** The Speed Round ranks: a pencil, a ballpoint, a gel pen, a fountain pen, the 800 Club. */
export function RankEmblem({ rank, size = 72 }: { rank: string; size?: number }) {
  const line = { stroke: NAVY, strokeWidth: 3.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg viewBox="0 0 72 72" width={size} height={size} aria-hidden="true">
      <circle cx="36" cy="36" r="33" fill="#FBFCFF" {...line} />
      <g transform="rotate(-42 36 36)">
        {rank === 'pencil' && (
          <>
            <rect x="29" y="12" width="14" height="34" fill="#FFA23A" {...line} />
            <rect x="29" y="8" width="14" height="7" rx="2" fill="#FF6FB1" {...line} />
            <path d="M29 46 L36 60 L43 46Z" fill="#F6E3C4" {...line} />
            <path d="M33.5 55 L36 60 L38.5 55Z" fill={NAVY} />
          </>
        )}
        {rank === 'ballpoint' && (
          <>
            <rect x="30" y="8" width="12" height="40" rx="6" fill="#4CC9FF" {...line} />
            <path d="M30 46 L36 60 L42 46" fill="#FBFCFF" {...line} />
            <path d="M42 14 h4 v16" fill="none" {...line} />
          </>
        )}
        {rank === 'gel' && (
          <>
            <rect x="29" y="6" width="14" height="44" rx="4" fill="rgba(255,111,177,.45)" {...line} />
            <rect x="33" y="10" width="6" height="30" rx="3" fill="#FF6FB1" stroke="none" />
            <path d="M31 50 L36 61 L41 50" fill="#FBFCFF" {...line} />
          </>
        )}
        {rank === 'fountain' && (
          <>
            <rect x="29" y="6" width="14" height="30" rx="5" fill="#B79BFF" {...line} />
            <path d="M29 36 Q29 46 36 62 Q43 46 43 36Z" fill="#FFE53B" {...line} />
            <path d="M36 44 V56" {...line} />
            <circle cx="36" cy="44" r="2" fill={NAVY} />
          </>
        )}
      </g>
      {rank === 'club' && (
        <>
          <path d="M16 46 L13 22 L25 32 L36 16 L47 32 L59 22 L56 46Z" fill="#FFE53B" {...line} />
          <text x="36" y="44" textAnchor="middle" fontFamily="Anybody, sans-serif" fontWeight="900" fontSize="13" fill={NAVY}>
            800
          </text>
          <path d="M18 52 H54" {...line} />
        </>
      )}
    </svg>
  )
}

/** A roll of correction tape: the streak freeze. */
export function TapeGlyph({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="3" y="7" width="22" height="16" rx="5" fill="#4CC9FF" stroke={NAVY} strokeWidth="2.4" />
      <circle cx="12" cy="15" r="4.5" fill="#FBFCFF" stroke={NAVY} strokeWidth="2.2" />
      <path d="M25 18 L30 24 H16" fill="#FBFCFF" stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  )
}

export function InkGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 2.5 C12 2.5 4.5 11 4.5 15.2 A7.5 7.5 0 0 0 19.5 15.2 C19.5 11 12 2.5 12 2.5Z" fill="#4CC9FF" stroke={NAVY} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M8.8 15.5 A3.4 3.4 0 0 0 11 18.6" fill="none" stroke="#FBFCFF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function StreakGlyph({ size = 22, lit = true }: { size?: number; lit?: boolean }) {
  // a highlighter cap, glowing when today is done
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 2 C14 6 18.5 8.5 18.5 14 A6.5 6.5 0 0 1 5.5 14 C5.5 10.5 8 9 8.5 6 C10 7.5 10.5 9 10.5 10 C11.8 8.5 12.3 5.5 12 2Z"
        fill={lit ? '#FFA23A' : '#DFE8F7'}
        stroke={NAVY}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 12.5 C13.2 14 14.5 15 14.5 16.6 A2.5 2.5 0 0 1 9.5 16.6 C9.5 15 11 14 12 12.5Z" fill={lit ? '#FFE53B' : '#FBFCFF'} />
    </svg>
  )
}

/** A paper clip, the mark a miss carries while it waits to come back. */
export function ClipGlyph({ size = 26, color = RED }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 20 40" width={size * 0.5} height={size} aria-hidden="true">
      <path
        d="M14 12 V30 A5 5 0 0 1 4 30 V8 A3.5 3.5 0 0 1 11 8 V28 A1.5 1.5 0 0 1 8 28 V12"
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
