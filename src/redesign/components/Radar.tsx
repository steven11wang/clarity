// The skill radar — 洋葱学园's ability chart, rebuilt for the ten SAT skills.
// Each spoke is inked in its domain's highlighter; the filled shape is the
// student's strength, drawn in yellow highlighter over the grid paper.

import { ALL_SKILLS, SKILL_SHORT, domainOf } from '../game/content.ts'
import { INK_VAR } from './Glyphs.tsx'

type Props = {
  values: Record<string, number> // 0..1 per skill
  focus?: string | null
  onFocus?: (skill: string | null) => void
  size?: number
}

export function Radar({ values, focus = null, onFocus, size = 420 }: Props) {
  const c = 210
  const r = 150
  const n = ALL_SKILLS.length
  const at = (index: number, scale: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2
    return [c + Math.cos(angle) * r * scale, c + Math.sin(angle) * r * scale] as const
  }
  const shape = ALL_SKILLS.map((skill, index) => at(index, Math.max(0.06, values[skill] ?? 0)).join(',')).join(' ')

  return (
    <svg className="radar" viewBox="-90 -14 600 448" width={size} height={size * 0.75} role="img" aria-label="Skill strength across the ten SAT Reading and Writing skills">
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={ALL_SKILLS.map((_, index) => at(index, ring).join(',')).join(' ')}
          className="radar__ring"
        />
      ))}
      {ALL_SKILLS.map((skill, index) => {
        const [x, y] = at(index, 1)
        return (
          <line
            key={skill}
            x1={c}
            y1={c}
            x2={x}
            y2={y}
            className="radar__spoke"
            style={{ stroke: INK_VAR[domainOf(skill).ink], opacity: focus && focus !== skill ? 0.35 : 1 }}
          />
        )
      })}
      <polygon points={shape} className="radar__shape" />
      {ALL_SKILLS.map((skill, index) => {
        const [x, y] = at(index, Math.max(0.06, values[skill] ?? 0))
        return <circle key={skill} cx={x} cy={y} r={focus === skill ? 7 : 5} className="radar__dot" />
      })}
      {ALL_SKILLS.map((skill, index) => {
        const [x, y] = at(index, 1.2)
        const anchor = Math.abs(x - c) < 12 ? 'middle' : x > c ? 'start' : 'end'
        return (
          <g
            key={skill}
            className={`radar__label ${focus === skill ? 'is-focus' : ''}`}
            onPointerEnter={() => onFocus?.(skill)}
            onPointerLeave={() => onFocus?.(null)}
            onFocus={() => onFocus?.(skill)}
            onBlur={() => onFocus?.(null)}
            tabIndex={onFocus ? 0 : undefined}
          >
            <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle">
              {SKILL_SHORT[skill]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
