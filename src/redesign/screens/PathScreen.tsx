// The path: four chapters, one per domain, each a run of scantron bubbles
// joined by a pencil line. Done bubbles are filled, the current one pulses
// with 汤圆 sitting beside it, and a red clip marks a skill with comebacks due.

import { useEffect, useRef } from 'react'
import { BookOpen, Gift, Lock, PenLine, Swords } from 'lucide-react'

import { DOMAINS, PATH, type PathNode } from '../game/content.ts'
import { completeNode, currentNode, dueComebacks, isUnlocked, sectionNext, starCount } from '../game/engine.ts'
import { updateGame, useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { GameShell } from '../components/GameShell.tsx'
import { ClipGlyph, INK_VAR } from '../components/Glyphs.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'

const ICON = { lesson: BookOpen, page: PenLine, boss: Swords, chest: Gift } as const

// a gentle S-curve: each stop sits a little left or right of centre (px)
const sway = (i: number) => Math.round(Math.sin(i * 0.95) * 70)
const ROW = 118
const MID = 200

/** the pencil line through a chapter's stops, as a smooth curve */
function trailPath(offsets: number[], upto = offsets.length): string {
  const pts = offsets.slice(0, upto).map((x, i) => [MID + x, i * ROW + 37] as const)
  if (pts.length < 2) return ''
  return pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x} ${y}`
    const [px, py] = pts[i - 1]
    const my = (py + y) / 2
    return `${d} C${px} ${my} ${x} ${my} ${x} ${y}`
  }, '')
}

export function PathScreen() {
  const game = useGame()
  const day = useToday()
  const current = currentNode(game)
  const due = dueComebacks(game, day)
  const dueSkills = new Set(due.map((entry) => entry.skill))
  const here = useRef<HTMLDivElement>(null)

  useEffect(() => {
    here.current?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
  }, [])

  const open = (node: PathNode) => {
    if (!isUnlocked(game, node.id)) return
    if (node.kind === 'lesson') go(`/lesson/${node.id.replace(/-lesson$/, '')}`)
    else if (node.kind === 'chest') {
      updateGame((state) => completeNode(state, node.id))
      go('/me')
    } else go(`/play/${node.id}`)
  }

  return (
    <GameShell active="path">
      <div className="path">
        <header className="path__head">
          <h1 className="display">Your path</h1>
          <p>
            <b className="num">{starCount(game)}</b> of 30 stars · <b className="num">{game.completed.length}</b> of {PATH.length} stops
          </p>
        </header>
        {DOMAINS.map((domain) => {
          const nodes = PATH.filter((node) => node.domainId === domain.id)
          const doneCount = nodes.filter((node) => game.completed.includes(node.id)).length
          return (
            <section key={domain.id} className="chapter" style={{ ['--mark' as string]: INK_VAR[domain.ink] }} aria-labelledby={`ch-${domain.id}`}>
              <header className="chapter__tab">
                <h2 className="title" id={`ch-${domain.id}`}>
                  {domain.name}
                </h2>
                <span className="num">
                  {doneCount}/{nodes.length}
                </span>
              </header>
              <div className="trail">
                <svg className="trail__line" viewBox={`0 0 400 ${nodes.length * ROW}`} width="400" height={nodes.length * ROW} aria-hidden="true">
                  <path d={trailPath(nodes.map((node) => sway(PATH.indexOf(node))))} />
                  {doneCount > 0 && (
                    <path className="trail__done" d={trailPath(nodes.map((node) => sway(PATH.indexOf(node))), Math.min(nodes.length, doneCount + 1))} />
                  )}
                </svg>
                <ol className="trail__stops">
                {nodes.map((node) => {
                  const globalIndex = PATH.indexOf(node)
                  const done = game.completed.includes(node.id)
                  const isCurrent = node.id === current.id
                  const unlocked = isUnlocked(game, node.id)
                  // other sections show where they pick up too, without the mascot
                  const isOpen = !isCurrent && !done && sectionNext(game, domain.id)?.id === node.id
                  const Icon = unlocked || done ? ICON[node.kind] : Lock
                  const star = node.skill && node.difficulty && node.kind === 'page' ? game.skills[node.skill]?.stars[node.difficulty] : undefined
                  return (
                    <li
                      key={node.id}
                      className={`stop stop--${node.kind} ${done ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''} ${isOpen ? 'is-open' : ''} ${unlocked ? '' : 'is-locked'}`}
                      style={{ ['--sway' as string]: sway(globalIndex) }}
                    >
                      <div className="stop__anchor" ref={isCurrent ? here : undefined}>
                        {isCurrent && (
                          <span className="stop__mascot">
                            <Tangyuan outfit={game.outfit} size={64} />
                          </span>
                        )}
                        <button
                          type="button"
                          className="stop__bubble"
                          onClick={() => open(node)}
                          disabled={!unlocked}
                          aria-label={`${node.title}${done ? ', done' : isCurrent ? ', up next' : isOpen ? ', open' : unlocked ? '' : ', locked'}`}
                        >
                          <Icon aria-hidden="true" />
                        </button>
                        {node.skill && dueSkills.has(node.skill) && node.kind === 'lesson' && (
                          <span className="stop__clip" title="Comebacks due in this skill">
                            <ClipGlyph size={30} />
                          </span>
                        )}
                        <span className="stop__label">
                          {node.title}
                          {node.kind === 'page' && (
                            <svg viewBox="0 0 20 20" className={`stop__star ${star ? 'is-lit' : ''}`} aria-label={star ? 'star earned' : 'no star yet'}>
                              <path d="M10 1.8 L12.5 7 L18.2 7.6 L13.9 11.4 L15.1 17.2 L10 14.3 L4.9 17.2 L6.1 11.4 L1.8 7.6 L7.5 7Z" />
                            </svg>
                          )}
                        </span>
                        {isCurrent && (
                          <button type="button" className="btn btn--sm stop__start" onClick={() => open(node)}>
                            Start
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
                </ol>
              </div>
            </section>
          )
        })}
      </div>
    </GameShell>
  )
}
