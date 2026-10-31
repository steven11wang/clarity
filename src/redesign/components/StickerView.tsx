import type { PointerEvent } from 'react'

import type { Sticker } from '../game/content.ts'
import { INK_VAR, SkillGlyph, StampGlyph, TrapGlyph } from './Glyphs.tsx'
import { Tangyuan } from './Tangyuan.tsx'
import type { TrapType } from '../../types.ts'

/** A die-cut sticker. Holo foil follows the pointer, the way foil catches a lamp. */
export function StickerView({ sticker, owned = true, count = 0, size }: { sticker: Sticker; owned?: boolean; count?: number; size?: number }) {
  const tilt = (event: PointerEvent<HTMLDivElement>) => {
    if (sticker.rarity !== 'holo') return
    const box = event.currentTarget.getBoundingClientRect()
    const angle = Math.atan2(event.clientY - box.top - box.height / 2, event.clientX - box.left - box.width / 2)
    event.currentTarget.style.setProperty('--foil', `${(angle * 180) / Math.PI + 180}deg`)
    event.currentTarget.style.animationPlayState = 'paused'
  }
  const release = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.animationPlayState = ''
  }

  if (!owned) {
    return (
      <div className="sticker sticker--empty" style={size ? { width: size } : undefined} aria-label="Not collected yet">
        <span className="sticker__name">?</span>
      </div>
    )
  }

  return (
    <div
      className={`sticker sticker--${sticker.rarity}`}
      style={{ ['--mark' as string]: INK_VAR[sticker.ink], width: size }}
      onPointerMove={tilt}
      onPointerLeave={release}
      aria-label={`${sticker.name} sticker`}
    >
      {sticker.glyph === 'trap' && <TrapGlyph trap={sticker.id.replace('trap-', '') as TrapType} />}
      {sticker.glyph === 'skill' && <SkillGlyph />}
      {sticker.glyph === 'stamp' && <StampGlyph />}
      {sticker.glyph === 'mascot' && <Tangyuan outfit={sticker.outfit} idle={false} size={64} />}
      <span className="sticker__name">{sticker.name}</span>
      {count > 1 && <span className="sticker__count num">×{count}</span>}
    </div>
  )
}
