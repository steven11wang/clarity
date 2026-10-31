// Me: 汤圆 and its wardrobe, the sticker book, the skill radar, the streak
// calendar, and the preview tools for moving the clock.

import { useState, type FormEvent } from 'react'
import { FastForward, LogIn, LogOut, RotateCcw, Volume2, VolumeX } from 'lucide-react'

import { isSupabaseConfigured, supabase } from '../../lib/supabase.ts'
import { validateName } from '../game/identity.ts'
import { go } from '../router.ts'
import { setSound, useSound } from '../sound.ts'

import { ALL_SKILLS, CORRECTION_TAPE_PRICE, OUTFITS, SKILL_SHORT, STICKERS, domainOf } from '../game/content.ts'
import { addDays, levelInfo, skillStrength, starCount } from '../game/engine.ts'
import { advanceDay, resetGame, updateGame, useGame, useToday } from '../game/store.ts'
import { GameShell } from '../components/GameShell.tsx'
import { INK_VAR, InkGlyph, StreakGlyph, TapeGlyph } from '../components/Glyphs.tsx'
import { FounderBadge, FounderCode } from '../components/FounderCode.tsx'
import { buzz } from '../components/hooks.ts'
import { PackOpener } from '../components/Panels.tsx'
import { Radar } from '../components/Radar.tsx'
import { StickerView } from '../components/StickerView.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'
import { play } from '../sound.ts'

export function Me() {
  const game = useGame()
  const day = useToday()
  const level = levelInfo(game.xp)
  const [focus, setFocus] = useState<string | null>(null)
  const values = Object.fromEntries(ALL_SKILLS.map((skill) => [skill, skillStrength(game.skills[skill])]))
  const answered = Object.values(game.skills).reduce((sum, s) => sum + s.answered, 0)
  const correct = Object.values(game.skills).reduce((sum, s) => sum + s.correct, 0)
  const collected = STICKERS.filter((sticker) => game.stickers[sticker.id]).length

  const days = Array.from({ length: 28 }, (_, i) => addDays(day, i - 27))
  const studied = new Set(game.streak.days)

  const buy = (id: (typeof OUTFITS)[number]['id'], price: number) => {
    if (game.owned.includes(id)) {
      updateGame((state) => ({ ...state, outfit: id }))
      return
    }
    // a code-only outfit is never sold: send them to the code box
    if (OUTFITS.find((outfit) => outfit.id === id)?.codeOnly) {
      document.getElementById('founder-code')?.focus()
      return
    }
    if (game.ink < price) return
    buzz(16)
    play('ink')
    updateGame((state) => ({ ...state, ink: state.ink - price, owned: [...state.owned, id], outfit: id }))
  }

  return (
    <GameShell active="me">
      <div className="me">
        <section className="me__card sheet">
          <div className="me__avatar">
            <Tangyuan outfit={game.outfit} size={170} mood="wink" />
          </div>
          <div className="me__who">
            <p className="nameplate">
              <span className="nameplate__name">{game.name.trim() || 'Student'}</span>
              {game.founder && <FounderBadge size="md" />}
            </p>
            <h1 className="display">Level {level.level}</h1>
            <span className="meter meter--thick" style={{ ['--value' as string]: level.progress }}>
              <span />
            </span>
            <p className="num">
              {level.into}/{level.need} XP to level {level.level + 1}
            </p>
            <dl className="me__stats">
              <div>
                <dt>Best streak</dt>
                <dd className="num">
                  <StreakGlyph size={18} /> {game.streak.best}
                </dd>
              </div>
              <div>
                <dt>Accuracy</dt>
                <dd className="num">{answered ? Math.round((correct / answered) * 100) : 0}%</dd>
              </div>
              <div>
                <dt>Answered</dt>
                <dd className="num">{answered}</dd>
              </div>
              <div>
                <dt>Stars</dt>
                <dd className="num">{starCount(game)}/30</dd>
              </div>
            </dl>
          </div>
        </section>

        <Settings />

        <section className="me__section" aria-labelledby="wardrobe-title">
          <header className="panel__head">
            <h2 className="title panel__title" id="wardrobe-title">
              Wardrobe
            </h2>
            <a className="panel__link num" href="#/shop">
              <InkGlyph size={16} /> {game.ink} drops · Get more
            </a>
          </header>
          <div className="wardrobe">
            {OUTFITS.map((outfit) => {
              const owned = game.owned.includes(outfit.id)
              const worn = game.outfit === outfit.id
              return (
                <button
                  key={outfit.id}
                  type="button"
                  className={`closet ${worn ? 'is-worn' : ''} ${owned ? 'is-owned' : ''} ${outfit.art ? 'closet--art' : ''}`}
                  onClick={() => buy(outfit.id, outfit.price)}
                  disabled={!owned && !outfit.codeOnly && game.ink < outfit.price}
                  aria-pressed={worn}
                >
                  <Tangyuan outfit={outfit.id} size={84} idle={false} />
                  <b>{outfit.name}</b>
                  <span className="closet__blurb">{outfit.blurb}</span>
                  <span className="closet__price num">
                    {worn ? 'Wearing' : owned ? 'Wear' : outfit.codeOnly ? 'Code only' : (
                      <>
                        <InkGlyph size={14} /> {outfit.price}
                      </>
                    )}
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              className="closet closet--tape"
              disabled={game.ink < CORRECTION_TAPE_PRICE || game.streak.tapes >= 2}
              onClick={() => updateGame((state) => ({ ...state, ink: state.ink - CORRECTION_TAPE_PRICE, streak: { ...state.streak, tapes: state.streak.tapes + 1 } }))}
            >
              <TapeGlyph size={64} />
              <b>Correction tape</b>
              <span className="closet__blurb">Covers one missed day. Hold up to two.</span>
              <span className="closet__price num">
                {game.streak.tapes >= 2 ? 'Full' : (
                  <>
                    <InkGlyph size={14} /> {CORRECTION_TAPE_PRICE}
                  </>
                )}
              </span>
            </button>
          </div>
          <FounderCode />
        </section>

        <div className="me__duo">
          <section className="me__section" aria-labelledby="radar-title">
            <header className="panel__head">
              <h2 className="title panel__title" id="radar-title">
                Skill radar
              </h2>
              <span className="panel__aside">{focus ? `${SKILL_SHORT[focus]}: ${game.skills[focus]?.correct ?? 0}/${game.skills[focus]?.answered ?? 0}` : 'hover a skill'}</span>
            </header>
            <div className="me__radar sheet">
              <Radar values={values} focus={focus} onFocus={setFocus} size={400} />
            </div>
            <div className="me__stars">
              {ALL_SKILLS.map((skill) => (
                <span key={skill} className="me__starrow" style={{ ['--mark' as string]: INK_VAR[domainOf(skill).ink] }}>
                  <span>{SKILL_SHORT[skill]}</span>
                  {(['Easy', 'Medium', 'Hard'] as const).map((d) => (
                    <svg key={d} viewBox="0 0 20 20" className={`stop__star ${game.skills[skill]?.stars[d] ? 'is-lit' : ''}`} aria-label={`${d} ${game.skills[skill]?.stars[d] ? 'earned' : 'not yet'}`}>
                      <path d="M10 1.8 L12.5 7 L18.2 7.6 L13.9 11.4 L15.1 17.2 L10 14.3 L4.9 17.2 L6.1 11.4 L1.8 7.6 L7.5 7Z" />
                    </svg>
                  ))}
                </span>
              ))}
            </div>
          </section>

          <section className="me__section" aria-labelledby="book-title">
            <header className="panel__head">
              <h2 className="title panel__title" id="book-title">
                Sticker book
              </h2>
              <span className="panel__aside num">
                {collected}/{STICKERS.length}
              </span>
            </header>
            <PackOpener />
            <div className="stickerbook">
              {STICKERS.map((sticker) => (
                <StickerView key={sticker.id} sticker={sticker} owned={Boolean(game.stickers[sticker.id])} count={game.stickers[sticker.id] ?? 0} />
              ))}
            </div>
            <p className="panel__note">
              Holo foil is guaranteed by your tenth pack — <b className="num">{10 - game.pity}</b> to go.
            </p>
          </section>
        </div>

        <section className="me__section" aria-labelledby="cal-title">
          <header className="panel__head">
            <h2 className="title panel__title" id="cal-title">
              Last four weeks
            </h2>
          </header>
          <div className="calendar sheet">
            {days.map((d) => {
              const taped = studied.has(`tape:${d}`)
              const done = studied.has(d)
              return (
                <span key={d} className={`cal-day ${done ? 'is-done' : ''} ${taped ? 'is-taped' : ''} ${d === day ? 'is-today' : ''}`} title={d}>
                  <span className="num">{Number(d.slice(8))}</span>
                  {done && <StreakGlyph size={18} />}
                  {taped && <TapeGlyph size={18} />}
                </span>
              )
            })}
          </div>
        </section>

        <section className="me__tools" aria-labelledby="tools-title">
          <h2 className="title" id="tools-title">
            Preview tools
          </h2>
          <p>Move the clock to watch comebacks come due and the streak and tape work.</p>
          <div>
            <button type="button" className="btn btn--sm btn--paper" onClick={() => advanceDay(1)}>
              <FastForward /> Jump +1 day
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                if (window.confirm('Start the preview game over? This only clears the redesign preview, never the real app.')) resetGame()
              }}
            >
              <RotateCcw /> Reset preview game
            </button>
          </div>
        </section>
      </div>
    </GameShell>
  )
}

function Settings() {
  const game = useGame()
  const sound = useSound()
  const [draft, setDraft] = useState(game.name)
  const [note, setNote] = useState<string | null>(null)
  const account = game.account

  const saveName = async (event: FormEvent) => {
    event.preventDefault()
    const problem = validateName(draft)
    if (problem) {
      setNote(problem)
      return
    }
    if (account?.kind === 'cloud' && isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ data: { display_name: draft.trim() } })
      if (error) {
        setNote(error.message)
        return
      }
    }
    updateGame((state) => ({ ...state, name: draft.trim() }))
    setNote('Saved.')
    play('stamp')
  }

  const signOut = async () => {
    if (account?.kind === 'cloud' && supabase) await supabase.auth.signOut()
    updateGame((state) => ({ ...state, account: undefined }))
  }

  return (
    <section className="settings" aria-label="Account and sound">
      <div className="settings__block sheet">
        <h2 className="title">Account</h2>
        <p className="settings__line">
          {account?.kind === 'cloud' ? (
            <>
              Signed in as <b>{account.email}</b>. The same account works in the live app.
            </>
          ) : account?.kind === 'device' ? (
            <>Saved on this device{account.email ? ` for ${account.email}` : ''}. Sign in with an account to take it to your phone.</>
          ) : (
            <>Playing as a guest. Progress stays in this browser until you sign in.</>
          )}
        </p>
        <form className="settings__name" onSubmit={saveName}>
          <label className="field">
            <span className="field__label">Nickname friends see</span>
            <span className="settings__row">
              <input className="field__input" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={20} placeholder="e.g. Mina K." />
              <button type="submit" className="btn btn--sm">
                Save
              </button>
            </span>
          </label>
          {note && <span className="settings__note">{note}</span>}
        </form>
        <div className="settings__row">
          {account?.kind === 'cloud' ? (
            <button type="button" className="btn btn--sm btn--ghost" onClick={signOut}>
              <LogOut /> Sign out
            </button>
          ) : (
            <button type="button" className="btn btn--sm" onClick={() => go('/signin')}>
              <LogIn /> {account ? 'Sign in with an account' : 'Sign in'}
            </button>
          )}
        </div>
      </div>

      <div className="settings__block sheet">
        <h2 className="title">Sound</h2>
        <button type="button" className={`switch ${sound.on ? 'is-on' : ''}`} role="switch" aria-checked={sound.on} onClick={() => setSound({ on: !sound.on })}>
          <span className="switch__track">
            <span className="switch__knob" />
          </span>
          {sound.on ? <Volume2 size={18} /> : <VolumeX size={18} />} {sound.on ? 'Sounds on' : 'Sounds off'}
        </button>
        <label className="field settings__volume">
          <span className="field__label">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={sound.volume}
            disabled={!sound.on}
            onChange={(event) => setSound({ volume: Number(event.target.value) })}
          />
        </label>
        <p className="settings__line">Short cues for picks, grading, stamps and packs. Exams are always silent, and on an iPhone the ringer switch mutes them too.</p>
      </div>
    </section>
  )
}
