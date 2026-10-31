// 汤圆, Clarity's mascot, redrawn crisp for the redesign: the same rice-ball
// geometry as public/avatars, without the wobble filter, so it can blink, bob
// and change outfits at any size.

import type { OutfitId } from '../game/content.ts'
import jade from '../assets/avatars/jade-atelier.webp'
import moonlit from '../assets/avatars/moonlit-scholar.webp'
import obsidian from '../assets/avatars/obsidian-regent.webp'
import summer from '../assets/avatars/summer-scholar.webp'

/** Painted portraits: their faces are fixed, so moods show as a tilt or a hop. */
const ART: Partial<Record<OutfitId, string>> = { jade, moonlit, obsidian, summer }

export type Mood = 'happy' | 'wow' | 'sad' | 'think' | 'wink'

type Props = {
  outfit?: OutfitId
  mood?: Mood
  size?: number
  idle?: boolean
  className?: string
  label?: string
}

const STROKE = '#17183B'

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'wow':
      return <ellipse cx="80" cy="99" rx="7" ry="8.5" fill={STROKE} />
    case 'sad':
      return <path d="M71 102 Q80 94 89 102" fill="none" stroke={STROKE} strokeWidth="3.6" strokeLinecap="round" />
    case 'think':
      return <path d="M73 99 H88" fill="none" stroke={STROKE} strokeWidth="3.6" strokeLinecap="round" />
    default:
      return <path d="M71 95 Q80 105 89 95" fill="none" stroke={STROKE} strokeWidth="3.6" strokeLinecap="round" />
  }
}

function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'wink') {
    return (
      <g className="ty-eyes">
        <rect x="59" y="71" width="9" height="17" rx="4.5" fill={STROKE} />
        <path d="M89 80 Q95 74 101 80" fill="none" stroke={STROKE} strokeWidth="3.6" strokeLinecap="round" />
      </g>
    )
  }
  const dx = mood === 'think' ? 4 : 0
  const h = mood === 'sad' ? 13 : 17
  return (
    <g className="ty-eyes">
      <rect x={59 + dx} y={71 + (17 - h)} width="9" height={h} rx="4.5" fill={STROKE} />
      <rect x={92 + dx} y={71 + (17 - h)} width="9" height={h} rx="4.5" fill={STROKE} />
    </g>
  )
}

function Outfit({ outfit }: { outfit: OutfitId }) {
  const line = { stroke: STROKE, strokeWidth: 4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  switch (outfit) {
    case 'scholar':
      return (
        <g>
          <path d="M54 38 v15 q26 11 52 0 v-15Z" fill="#2B2D5C" {...line} />
          <path d="M80 14 L130 30 L80 46 L30 30Z" fill="#2B2D5C" {...line} />
          <path d="M126 32 V58" fill="none" stroke="#FFE53B" strokeWidth="4" strokeLinecap="round" />
          <circle cx="126" cy="61" r="5" fill="#E5262D" {...line} strokeWidth={3} />
        </g>
      )
    case 'specs':
      return (
        <g fill="rgba(76,201,255,.28)" {...line} strokeWidth={3.6}>
          <circle cx="63" cy="80" r="14" />
          <circle cx="97" cy="80" r="14" />
          <path d="M77 79 Q80 75 83 79" fill="none" />
          <path d="M49 77 L34 72 M111 77 L126 72" fill="none" />
        </g>
      )
    case 'beats':
      return (
        <g {...line}>
          <path d="M28 82 Q28 24 80 24 Q132 24 132 82" fill="none" strokeWidth={6} stroke="#17183B" />
          <rect x="17" y="70" width="20" height="32" rx="9" fill="#FF6FB1" />
          <rect x="123" y="70" width="20" height="32" rx="9" fill="#FF6FB1" />
        </g>
      )
    case 'nap':
      return (
        <g {...line}>
          <path d="M40 50 Q60 18 98 22 Q132 26 146 64 Q120 46 104 40 Q70 30 40 50Z" fill="#B79BFF" />
          <path d="M38 52 Q80 30 118 46" fill="none" stroke="#FBFCFF" strokeWidth={7} />
          <circle cx="146" cy="66" r="9" fill="#FBFCFF" />
        </g>
      )
    case 'spark':
      return (
        <g {...line} strokeWidth={3.4}>
          <path
            d="M114 22 L119 34 L132 35 L122 43 L126 56 L114 49 L102 56 L106 43 L96 35 L109 34Z"
            fill="#FFE53B"
          />
        </g>
      )
    case 'headband':
      return (
        <g {...line} strokeWidth={3.4}>
          <path d="M31 62 Q80 40 129 62 L127 72 Q80 50 33 72Z" fill="#E5262D" />
          <path d="M127 64 L146 56 L142 70 Z M127 68 L144 80 L132 82Z" fill="#E5262D" />
        </g>
      )
    default:
      return null
  }
}

export function Tangyuan({ outfit = 'none', mood = 'happy', size = 120, idle = true, className = '', label }: Props) {
  const art = ART[outfit]
  if (art) {
    return (
      <img
        className={`tangyuan tangyuan--art tangyuan--${mood} ${idle ? 'tangyuan--idle' : ''} ${className}`}
        src={art}
        width={size}
        height={size}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        draggable={false}
        decoding="async"
      />
    )
  }
  return (
    <svg
      className={`tangyuan ${idle ? 'tangyuan--idle' : ''} ${className}`}
      viewBox="0 0 160 160"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ellipse className="ty-shadow" cx="80" cy="144" rx="44" ry="7" fill="rgba(23,24,59,.12)" />
      <g className="ty-body">
        <ellipse cx="80" cy="86" rx="56" ry="50" fill="#FFFFFF" stroke={STROKE} strokeWidth="5" />
        <path d="M44 62 Q52 50 64 46" fill="none" stroke="#DFE8F7" strokeWidth="6" strokeLinecap="round" />
        <Eyes mood={mood} />
        <ellipse cx="50" cy="96" rx="9" ry="5.5" fill="#FF9FC8" />
        <ellipse cx="110" cy="96" rx="9" ry="5.5" fill="#FF9FC8" />
        <Mouth mood={mood} />
        <Outfit outfit={outfit} />
      </g>
    </svg>
  )
}
