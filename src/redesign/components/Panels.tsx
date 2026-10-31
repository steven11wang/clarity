// The side-of-the-desk panels: daily quests, the weekly stamp card, the study
// group league, and the sticker pack you tear open.

import { useRef, useState } from 'react'
import { Check, Gift } from 'lucide-react'

import { LEAGUES, QUEST_TEMPLATES, type Sticker } from '../game/content.ts'
import { WEEKLY_STAMPS, claimQuest, claimWeekly, daysBetween, drawSticker, hash, leagueStandings, seeded } from '../game/engine.ts'
import { updateGame, useGame, useToday } from '../game/store.ts'
import { InkGlyph } from './Glyphs.tsx'
import { buzz } from './hooks.ts'
import { StickerView } from './StickerView.tsx'
import { Tangyuan } from './Tangyuan.tsx'
import { play } from '../sound.ts'

export function Quests() {
  const game = useGame()
  const [justClaimed, setJustClaimed] = useState<string | null>(null)
  return (
    <section className="panel" aria-labelledby="quests-title">
      <header className="panel__head">
        <h2 className="title panel__title" id="quests-title">
          Today’s quests
        </h2>
        <span className="panel__aside">reset at midnight</span>
      </header>
      <ul className="quests">
        {game.quests.items.map((quest) => {
          const template = QUEST_TEMPLATES.find((item) => item.kind === quest.kind)
          if (!template) return null
          const done = quest.progress >= quest.target
          return (
            <li key={quest.kind} className={`quest ${quest.claimed ? 'is-claimed' : done ? 'is-done' : ''}`}>
              <div className="quest__text">
                <span className={quest.claimed ? 'hl hl--green' : ''}>{template.label(quest.target)}</span>
                <span className="quest__count num">
                  {quest.progress}/{quest.target}
                </span>
              </div>
              <div className="meter" style={{ ['--value' as string]: quest.progress / quest.target }}>
                <span />
              </div>
              {done && !quest.claimed ? (
                <button
                  type="button"
                  className="btn btn--sm btn--hl quest__claim"
                  onClick={() => {
                    updateGame((state) => claimQuest(state, quest.kind))
                    setJustClaimed(quest.kind)
                    buzz(16)
                    play('ink')
                  }}
                >
                  Claim <InkGlyph size={16} /> {template.ink}
                </button>
              ) : (
                <span className="quest__reward num">
                  {quest.claimed ? (
                    <span className={`stamp stamp--sm ${justClaimed === quest.kind ? 'is-landing' : ''}`}>Done</span>
                  ) : (
                    <>
                      <InkGlyph size={15} /> {template.ink}
                    </>
                  )}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function WeeklyCard() {
  const game = useGame()
  const full = game.weekly.stamps >= WEEKLY_STAMPS
  return (
    <section className="panel panel--card" aria-labelledby="weekly-title">
      <header className="panel__head">
        <h2 className="title panel__title" id="weekly-title">
          Weekly stamp card
        </h2>
        <span className="panel__aside num">
          {game.weekly.stamps}/{WEEKLY_STAMPS}
        </span>
      </header>
      <div className="stampcard">
        {Array.from({ length: WEEKLY_STAMPS }, (_, i) => (
          <span key={i} className={`stampcard__slot ${i < game.weekly.stamps ? 'is-stamped' : ''}`}>
            {i < game.weekly.stamps && <span className="stamp stamp--dot">{i === 0 ? <span className="zh">赠</span> : <Check size={16} strokeWidth={3} />}</span>}
          </span>
        ))}
      </div>
      <p className="panel__note">
        {game.weekly.claimed
          ? 'Claimed. A new card arrives Monday.'
          : full
            ? 'Full card: two sticker packs and 12 drops.'
            : 'The first stamp is on us. Each day you turn in a page adds one.'}
      </p>
      {full && !game.weekly.claimed && (
        <button
          type="button"
          className="btn btn--sm btn--hl"
          onClick={() => {
            updateGame(claimWeekly)
            play('reveal')
          }}
        >
          <Gift /> Claim the card
        </button>
      )}
    </section>
  )
}

export function League({ rows = 5 }: { rows?: number }) {
  const game = useGame()
  const day = useToday()
  const standings = leagueStandings(game, day)
  const you = standings.findIndex((row) => row.you)
  const left = 7 - (daysBetween(game.league.week, day) + 1)
  const shown = standings.slice(0, rows)
  const youShown = you < rows
  return (
    <section className="panel" aria-labelledby="league-title">
      <header className="panel__head">
        <h2 className="title panel__title" id="league-title">
          {LEAGUES[game.league.tier]} league
        </h2>
        <span className="panel__aside">{left === 0 ? 'ends tonight' : `${left} days left`}</span>
      </header>
      <ol className="league">
        {shown.map((row, i) => (
          <li key={row.name} className={`league__row ${row.you ? 'is-you' : ''} ${i < 3 ? 'is-up' : ''}`}>
            <span className="league__place num">{i + 1}</span>
            <Tangyuan outfit={row.pet} size={30} idle={false} />
            <span className="league__name">{row.you ? 'You' : row.name}</span>
            <span className="league__xp num">{row.xp} XP</span>
          </li>
        ))}
        {!youShown && (
          <li className="league__row is-you">
            <span className="league__place num">{you + 1}</span>
            <Tangyuan outfit={game.outfit} size={30} idle={false} />
            <span className="league__name">You</span>
            <span className="league__xp num">{game.league.xp} XP</span>
          </li>
        )}
      </ol>
      <p className="panel__note">Top 3 move up on Monday. <span className="hand">sample study group</span></p>
    </section>
  )
}

export function PackOpener({ onOpened }: { onOpened?: (sticker: Sticker) => void }) {
  const game = useGame()
  const [shown, setShown] = useState<{ sticker: Sticker; key: number } | null>(null)
  const [tearing, setTearing] = useState(false)
  const rand = useRef(seeded(hash(`packs:${Date.now()}`)))

  const open = () => {
    if (tearing || game.packs < 1) return
    setTearing(true)
    buzz([8, 40, 18])
    play('rip')
    window.setTimeout(() => {
      let drawn: Sticker | null = null
      updateGame((state) => {
        const result = drawSticker(state, rand.current)
        drawn = result.sticker
        return result.state
      })
      if (drawn) {
        play((drawn as Sticker).rarity === 'holo' ? 'holo' : 'reveal')
        setShown({ sticker: drawn, key: Date.now() })
        onOpened?.(drawn)
      }
      setTearing(false)
    }, 560)
  }

  return (
    <div className="opener">
      <button type="button" className={`pack ${tearing ? 'is-tearing' : ''}`} onClick={open} disabled={game.packs < 1} aria-label={`Open a sticker pack, ${game.packs} left`}>
        <span className="pack__top" />
        <span className="pack__body">
          <Gift />
          <span className="num">{game.packs} pack{game.packs === 1 ? '' : 's'}</span>
          <span className="pack__hint">{game.packs > 0 ? 'tap to tear' : 'turn in a page'}</span>
        </span>
      </button>
      <div className="opener__reveal" aria-live="polite">
        {!shown && (
          <p className="opener__hint">
            <span className="hand">{game.packs > 0 ? 'rip it open' : 'every page you turn in drops a pack'}</span>
            <span>
              Holo foil guaranteed within <b className="num">{10 - game.pity}</b> pack{10 - game.pity === 1 ? '' : 's'}.
            </span>
          </p>
        )}
        {shown && (
          <div className="reveal-pop" key={shown.key}>
            <StickerView sticker={shown.sticker} size={132} />
            <p>
              <strong>{shown.sticker.name}</strong>
              {shown.sticker.rarity === 'holo' && ' · Holo foil!'}
              {shown.sticker.outfit && ' · new outfit unlocked'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
