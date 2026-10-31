// Founding members: a code from the Governor's School promotion unlocks the
// Summer Scholar, the honor title, and drops — some now, the rest after ten
// study days. In the Shop and on Me it's one small line; #/founders has the
// full panel. A good code opens the reveal (FounderReveal.tsx).

import { useState, type FormEvent } from 'react'
import { Gift, Sparkles, X } from 'lucide-react'

import { isSupabaseConfigured, supabase } from '../../lib/supabase.ts'
import { FOUNDER } from '../game/content.ts'
import { founderDays, grantFounder } from '../game/engine.ts'
import { isFounderCode } from '../game/promo.ts'
import { getGame, updateGame, useGame, useToday } from '../game/store.ts'
import { play } from '../sound.ts'
import { FounderReveal } from './FounderReveal.tsx'
import { InkGlyph } from './Glyphs.tsx'
import { Tangyuan } from './Tangyuan.tsx'
import '../styles/founders.css'

/** The honor title: a foil ribbon that sits after a founding member's name. */
export function FounderBadge({ size = 'sm' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`honor honor--${size}`} title={FOUNDER.title}>
      <Sparkles aria-hidden="true" />
      <span>{size === 'sm' ? 'Founder' : FOUNDER.title}</span>
    </span>
  )
}

type Outcome = 'idle' | 'checking' | 'unknown' | 'full'

/**
 * Online with an account, the server decides (one per account, capped). If the
 * server function isn't there yet, or there's no account, the code is checked here.
 */
async function redeem(code: string): Promise<'ok' | 'unknown' | 'full'> {
  const account = getGame().account
  if (isSupabaseConfigured && supabase && account?.kind === 'cloud') {
    const { data, error } = await supabase.rpc('redeem_founder_code', { p_code: code })
    if (!error && data && typeof data === 'object') {
      const result = data as { ok?: boolean; reason?: string }
      if (result.ok) return 'ok'
      return result.reason === 'full' ? 'full' : 'unknown'
    }
  }
  return (await isFounderCode(code)) ? 'ok' : 'unknown'
}

const MESSAGES: Record<'unknown' | 'full', string> = {
  unknown: 'That code isn’t one we know. Check the spelling with whoever gave it to you.',
  full: 'Every founding spot on that code is taken. Thank you for coming anyway.',
}

/** The code box and its submit, shared by the small line and the full panel. */
function useRedeem(initialCode: string) {
  const day = useToday()
  const [code, setCode] = useState(initialCode)
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const [revealing, setRevealing] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim() || outcome === 'checking') return
    setOutcome('checking')
    const result = await redeem(code)
    if (result === 'ok') {
      updateGame((state) => grantFounder(state, day))
      setOutcome('idle')
      setRevealing(true)
    } else {
      play('wrong')
      setOutcome(result)
    }
  }
  const change = (value: string) => {
    setCode(value)
    if (outcome !== 'checking') setOutcome('idle')
  }
  return { code, change, outcome, submit, revealing, endReveal: () => setRevealing(false) }
}

function CodeForm({ redeemer, compact }: { redeemer: ReturnType<typeof useRedeem>; compact?: boolean }) {
  const { code, change, outcome, submit } = redeemer
  const bad = outcome === 'unknown' || outcome === 'full'
  return (
    <>
      <form className={`founder__form ${compact ? 'founder__form--compact' : ''}`} onSubmit={submit}>
        <label className="sr-only" htmlFor="founder-code">
          Code
        </label>
        <input
          id="founder-code"
          className="founder__input"
          value={code}
          onChange={(event) => change(event.target.value)}
          placeholder="Enter code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          autoFocus={compact}
          aria-invalid={bad}
          aria-describedby="founder-note"
        />
        <button type="submit" className={`btn ${compact ? 'btn--sm' : ''}`} disabled={!code.trim() || outcome === 'checking'}>
          {outcome === 'checking' ? 'Checking…' : 'Redeem'}
        </button>
      </form>
      <p id="founder-note" className="founder__note" aria-live="polite">
        {bad ? MESSAGES[outcome] : ''}
      </p>
    </>
  )
}

/** One small line: "Have a code?" opens the box in place. Founders see their ten-day walk. */
export function FounderCode({ initialCode = '' }: { initialCode?: string }) {
  const game = useGame()
  const redeemer = useRedeem(initialCode)
  const [open, setOpen] = useState(Boolean(initialCode))

  const reveal = redeemer.revealing && <FounderReveal onClose={redeemer.endReveal} />
  if (game.founder) {
    return (
      <>
        <FounderLine />
        {reveal}
      </>
    )
  }
  return (
    <div className={`codeline ${open ? 'is-open' : ''}`}>
      {open ? (
        <>
          <Gift className="codeline__icon" aria-hidden="true" />
          <div className="codeline__body">
            <CodeForm redeemer={redeemer} compact />
          </div>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close the code box">
            <X size={16} />
          </button>
        </>
      ) : (
        <button type="button" className="codeline__open" onClick={() => setOpen(true)}>
          <Gift aria-hidden="true" /> Have a code?
        </button>
      )}
    </div>
  )
}

/** After the code, the small line becomes the walk to the second half of the drops. */
function FounderLine() {
  const game = useGame()
  const done = Math.min(FOUNDER.goalDays, founderDays(game))
  return (
    <div className="codeline codeline--member">
      <FounderBadge size="md" />
      <span className="num codeline__goal">
        {game.founder?.goalPaid ? (
          <>
            {FOUNDER.goalDays} study days · <InkGlyph size={13} /> {FOUNDER.goalDrops} added
          </>
        ) : (
          <>
            {done}/{FOUNDER.goalDays} study days · <InkGlyph size={13} /> {FOUNDER.goalDrops} on day {FOUNDER.goalDays}
          </>
        )}
      </span>
      <ol className="founder__days" aria-hidden="true">
        {Array.from({ length: FOUNDER.goalDays }, (_, i) => (
          <li key={i} className={i < done ? 'is-done' : ''} />
        ))}
      </ol>
    </div>
  )
}

/** The full panel, for #/founders, where the poster's QR code lands. */
export function FounderPanel({ initialCode = '' }: { initialCode?: string }) {
  const game = useGame()
  const redeemer = useRedeem(initialCode)
  const reveal = redeemer.revealing && <FounderReveal onClose={redeemer.endReveal} />
  if (game.founder) {
    return (
      <>
        <section className="founder sheet">
          <Tangyuan outfit={FOUNDER.outfit} size={96} className="founder__art" />
          <div className="founder__body">
            <h2 className="title">You’re a founding member.</h2>
            <FounderLine />
          </div>
        </section>
        {reveal}
      </>
    )
  }
  return (
    <section className="founder sheet" aria-labelledby="founder-title">
      <Tangyuan outfit={FOUNDER.outfit} size={96} className="founder__art" />
      <div className="founder__body">
        <h2 className="title" id="founder-title">
          Enter your code
        </h2>
        <p>
          The <b>Summer Scholar</b>, the <b>{FOUNDER.title}</b> title by your name, and{' '}
          <b className="num">{FOUNDER.welcomeDrops + FOUNDER.goalDrops} drops</b>: {FOUNDER.welcomeDrops} now, {FOUNDER.goalDrops} on your{' '}
          {FOUNDER.goalDays}th study day.
        </p>
        <CodeForm redeemer={redeemer} />
      </div>
    </section>
  )
}
