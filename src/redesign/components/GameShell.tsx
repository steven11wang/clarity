// The notebook the game lives in: a HUD across the top (streak, tape, drops,
// level) and divider tabs down the side — or along the bottom on a phone —
// each tab inked in its section's highlighter.

import type { ReactNode } from 'react'
import { ClipboardCheck, House, Map, NotebookPen, Swords, Volume2, VolumeX } from 'lucide-react'

import { dueComebacks, levelInfo } from '../game/engine.ts'
import { useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { setSound, useSound } from '../sound.ts'
import { InkGlyph, StreakGlyph, TapeGlyph } from './Glyphs.tsx'
import { useCountUp } from './hooks.ts'
import { Logo } from './Logo.tsx'
import { Tangyuan } from './Tangyuan.tsx'

export type Tab = 'today' | 'path' | 'notebook' | 'arena' | 'exam' | 'me'

const TABS: Array<{ id: Tab; label: string; zh?: string; icon: typeof House; ink: string; path: string }> = [
  { id: 'today', label: 'Today', icon: House, ink: 'var(--yellow)', path: '/today' },
  { id: 'path', label: 'Path', icon: Map, ink: 'var(--green)', path: '/path' },
  { id: 'notebook', label: 'Mistakes', icon: NotebookPen, ink: 'var(--pink)', path: '/notebook' },
  { id: 'arena', label: 'Arena', icon: Swords, ink: 'var(--violet)', path: '/arena' },
  { id: 'exam', label: 'Exams', icon: ClipboardCheck, ink: 'var(--blue)', path: '/exams' },
]

export function Hud() {
  const game = useGame()
  const day = useToday()
  const level = levelInfo(game.xp)
  const ink = useCountUp(game.ink)
  const lit = game.streak.lastDay === day
  const sound = useSound()
  return (
    <header className="hud">
      <a className="hud__brand" href="#/" aria-label="Clarity home">
        <Logo />
      </a>
      <div className="hud__stats">
        <span className={`hud__stat ${lit ? 'is-lit' : ''}`} title={lit ? 'Streak safe today' : 'Turn in a page to keep your streak'}>
          <StreakGlyph lit={lit} />
          <b className="num">{game.streak.count}</b>
          <span className="hud__label">day streak</span>
        </span>
        <span className="hud__stat" title="Correction tape covers a missed day">
          <TapeGlyph size={24} />
          <b className="num">{game.streak.tapes}</b>
          <span className="hud__label">tape</span>
        </span>
        <a
          className="hud__stat hud__stat--link"
          href="#/shop"
          onClick={(event) => {
            event.preventDefault()
            go('/shop')
          }}
          title="Water drops: 10 drops = $1. Open the shop"
        >
          <InkGlyph />
          <b className="num">{ink}</b>
          <span className="hud__label">drops</span>
        </a>
        <span className="hud__level" title={`${level.into} of ${level.need} XP to level ${level.level + 1}`}>
          <span className="hud__lv num">Lv {level.level}</span>
          <span className="meter" style={{ ['--value' as string]: level.progress }}>
            <span />
          </span>
        </span>
        <button
          type="button"
          className="hud__icon hud__sound"
          onClick={() => setSound({ on: !sound.on })}
          aria-pressed={sound.on}
          aria-label={sound.on ? 'Sound on — mute' : 'Sound off — unmute'}
          title={sound.on ? 'Mute sounds' : 'Turn sounds on'}
        >
          {sound.on ? <Volume2 /> : <VolumeX />}
        </button>
        <a
          className={`hud__me ${game.founder ? 'is-founder' : ''}`}
          href="#/me"
          onClick={(event) => {
            event.preventDefault()
            go('/me')
          }}
          aria-label={`Your profile${game.name ? `, ${game.name}` : ''}${game.founder ? ', founding member' : ''}`}
        >
          <Tangyuan outfit={game.outfit} size={34} idle={false} />
        </a>
      </div>
    </header>
  )
}

export function GameShell({ active, children, wide = false }: { active: Tab; children: ReactNode; wide?: boolean }) {
  const game = useGame()
  const day = useToday()
  const due = dueComebacks(game, day).length
  return (
    <div className="game">
      <Hud />
      <nav className="tabs" aria-label="Game">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <a
              key={tab.id}
              href={`#${tab.path}`}
              onClick={(event) => {
                event.preventDefault()
                go(tab.path)
              }}
              className={`tab ${active === tab.id ? 'is-active' : ''}`}
              style={{ ['--mark' as string]: tab.ink }}
              aria-current={active === tab.id ? 'page' : undefined}
            >
              <Icon aria-hidden="true" />
              <span className={tab.zh ? 'zh' : ''}>{tab.label}</span>
              {tab.id === 'notebook' && due > 0 && (
                <span className="tab__badge num" aria-label={`${due} due`}>
                  {due}
                </span>
              )}
            </a>
          )
        })}
      </nav>
      <main className={`game__main ${wide ? 'game__main--wide' : ''}`} id="main">
        {children}
      </main>
    </div>
  )
}
