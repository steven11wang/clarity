// Sign in, redrawn as a student card. Same calls as the live app's sign-in
// (Google OAuth, email + password, reset link, Supabase sessions), so an
// account made here is the same account everywhere. Without Supabase on this
// server it says so and makes a profile on this device instead.

import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail, Smartphone } from 'lucide-react'

import { isSupabaseConfigured, supabase } from '../../lib/supabase.ts'
import { validateName } from '../game/identity.ts'
import { updateGame, useGame } from '../game/store.ts'
import { go } from '../router.ts'
import { Logo } from '../components/Logo.tsx'
import { Tangyuan, type Mood } from '../components/Tangyuan.tsx'
import { play } from '../sound.ts'

type View = 'choose' | 'email' | 'name' | 'sent'
type Mode = 'sign-in' | 'sign-up' | 'reset'

export const OAUTH_FLAG = 'clarity-redesign:oauth-return'

const GOOGLE = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z" />
    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15Z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z" />
  </svg>
)

/** After any sign-in: the onboarding if this is a new player, otherwise today. */
export function finishSignIn() {
  go('/today')
}

export function SignIn({ initialMode = 'sign-in' }: { initialMode?: Mode }) {
  const game = useGame()
  const [view, setView] = useState<View>('choose')
  const [mode, setMode] = useState<Mode>(initialMode)
  const [email, setEmail] = useState(game.account?.email ?? '')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [name, setName] = useState(game.name || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const online = isSupabaseConfigured && supabase

  const say: Record<View, { line: string; mood: Mood }> = {
    choose: { line: 'Sign in and your Mistake Notebook follows you to every device.', mood: 'happy' },
    email: {
      line: mode === 'sign-up' ? 'New card coming up. Pick a password you’ll remember.' : mode === 'reset' ? 'Happens to everyone. I’ll send a link.' : 'Welcome back. Your comebacks missed you.',
      mood: mode === 'reset' ? 'think' : 'wink',
    },
    name: { line: 'Last thing: what should friends see when you beat them?', mood: 'wow' },
    sent: { line: 'Check your inbox — the link is on its way.', mood: 'wink' },
  }

  const asDevice = (cleanEmail: string) => {
    updateGame((state) => ({ ...state, account: { kind: 'device', email: cleanEmail || undefined } }))
    setName((current) => current || cleanEmail.split('@')[0] || '')
    setView('name')
  }

  async function google() {
    setError(null)
    if (!online) {
      asDevice('')
      return
    }
    setBusy(true)
    try {
      sessionStorage.setItem(OAUTH_FLAG, '1')
    } catch {
      /* the return still signs them in; it just lands on the front page */
    }
    const { error: oauthError } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/redesign.html` },
    })
    if (oauthError) {
      setError(oauthError.message)
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    const cleanEmail = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError('That email doesn’t look right — check for a typo.')
      return
    }
    if (!online) {
      asDevice(cleanEmail)
      return
    }
    if (mode === 'reset') {
      setBusy(true)
      const { error: resetError } = await supabase!.auth.resetPasswordForEmail(cleanEmail, { redirectTo: `${window.location.origin}/redesign.html` })
      setBusy(false)
      if (resetError) setError(resetError.message)
      else setView('sent')
      return
    }
    if (password.length < 6) {
      setError('Passwords need at least 6 characters.')
      return
    }
    setBusy(true)
    const result =
      mode === 'sign-up'
        ? await supabase!.auth.signUp({ email: cleanEmail, password, options: { data: { avatar_id: 'clawd' } } })
        : await supabase!.auth.signInWithPassword({ email: cleanEmail, password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      play('wrong')
      return
    }
    const user = result.data.user
    if (!result.data.session || !user) {
      setNotice('Check your email to confirm your account, then sign in here.')
      setMode('sign-in')
      return
    }
    const saved = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : ''
    updateGame((state) => ({ ...state, account: { kind: 'cloud', userId: user.id, email: user.email ?? cleanEmail }, name: saved || state.name }))
    play('stamp')
    if (saved) finishSignIn()
    else {
      setName(cleanEmail.split('@')[0])
      setView('name')
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault()
    const problem = validateName(name)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setBusy(true)
    if (online && game.account?.kind === 'cloud') {
      const { error: updateError } = await supabase!.auth.updateUser({ data: { display_name: name.trim() } })
      if (updateError) {
        setBusy(false)
        setError(updateError.message)
        return
      }
    }
    updateGame((state) => ({ ...state, name: name.trim() }))
    setBusy(false)
    play('stamp')
    finishSignIn()
  }

  return (
    <div className="auth">
      <header className="auth__bar">
        <a href="#/" aria-label="Back to the front page">
          <Logo />
        </a>
        <a className="auth__back" href="#/">
          <ArrowLeft size={16} /> Front page
        </a>
      </header>

      <div className="auth__stage">
        <aside className="auth__mascot">
          <p className="speech speech--below auth__speech" key={view + mode} aria-live="polite">
            {say[view].line}
          </p>
          <Tangyuan size={200} mood={say[view].mood} outfit={view === 'name' ? 'scholar' : 'specs'} />
          <ul className="auth__perks">
            <li>
              <span className="hl">Your Mistake Notebook</span> on phone and laptop
            </li>
            <li>
              <span className="hl hl--violet">Play friends</span> with a code or link
            </li>
            <li>
              <span className="hl hl--orange">Keep your streak</span> when you switch devices
            </li>
          </ul>
        </aside>

        <section className="card" aria-labelledby="auth-title">
          <span className="card__hole" aria-hidden="true" />
          <div className="card__head">
            <span className="card__school">
              <Logo compact /> Clarity student card
            </span>
            <span className="card__no num" aria-hidden="true">
              No. {String(Math.abs((game.xp * 7919 + 1550) % 100000)).padStart(5, '0')}
            </span>
          </div>

          {!online && view !== 'name' && (
            <p className="card__offline">
              <Smartphone size={16} /> Accounts aren’t connected on this preview server, so signing in keeps everything on this device.
            </p>
          )}

          {view === 'choose' && (
            <>
              <h1 className="display card__title" id="auth-title">
                {mode === 'sign-up' ? 'Make your card' : 'Sign in'}
              </h1>
              <div className="card__actions">
                <button type="button" className="btn btn--lg btn--paper btn--block auth-google" onClick={google} disabled={busy}>
                  {GOOGLE} Continue with Google
                </button>
                <button type="button" className="btn btn--lg btn--block" onClick={() => setView('email')}>
                  <Mail /> Continue with email
                </button>
              </div>
              <div className="card__divider">
                <span>or</span>
              </div>
              <button
                type="button"
                className="card__guest"
                onClick={() => {
                  if (game.name) finishSignIn()
                  else {
                    setName('')
                    setView('name')
                  }
                }}
              >
                Play without an account <ArrowRight size={16} />
              </button>
              <p className="card__fine">Free. No fees, no credit card. Without an account, progress stays in this browser.</p>
            </>
          )}

          {view === 'email' && (
            <form className="card__form" onSubmit={submit} noValidate>
              <h1 className="display card__title" id="auth-title">
                {mode === 'sign-up' ? 'Make your card' : mode === 'reset' ? 'Reset password' : 'Sign in'}
              </h1>
              {error && (
                <p className="card__error" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="card__notice" role="status">
                  {notice}
                </p>
              )}
              <label className="field">
                <span className="field__label">Email</span>
                <input
                  className="field__input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.edu"
                  required
                />
              </label>
              {mode !== 'reset' && (
                <label className="field">
                  <span className="field__label">Password</span>
                  <span className="field__wrap">
                    <input
                      className="field__input"
                      type={reveal ? 'text' : 'password'}
                      autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
                      required
                    />
                    <button type="button" className="field__eye" onClick={() => setReveal(!reveal)} aria-label={reveal ? 'Hide password' : 'Show password'}>
                      {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
              )}
              <button type="submit" className="btn btn--lg btn--block" disabled={busy}>
                {busy ? 'One moment…' : mode === 'sign-up' ? 'Create my card' : mode === 'reset' ? 'Send the link' : 'Sign in'}
              </button>
              <div className="card__links">
                {mode === 'sign-in' ? (
                  <>
                    <button type="button" onClick={() => setMode('sign-up')}>
                      New here? Make a card
                    </button>
                    <button type="button" onClick={() => setMode('reset')}>
                      Forgot password
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setMode('sign-in')}>
                    I already have a card
                  </button>
                )}
                <button type="button" onClick={() => setView('choose')}>
                  Other ways in
                </button>
              </div>
            </form>
          )}

          {view === 'name' && (
            <form className="card__form" onSubmit={saveName} noValidate>
              <h1 className="display card__title" id="auth-title">
                Your name
              </h1>
              {error && (
                <p className="card__error" role="alert">
                  {error}
                </p>
              )}
              <label className="field">
                <span className="field__label">What friends see in matches and the Study Hall</span>
                <input
                  className="field__input field__input--big"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Mina K."
                  maxLength={20}
                  autoFocus
                />
              </label>
              <p className="card__fine">Use a nickname, not your full name. Never put a phone number or social handle here.</p>
              <button type="submit" className="btn btn--lg btn--block" disabled={busy}>
                That’s me <ArrowRight />
              </button>
            </form>
          )}

          {view === 'sent' && (
            <div className="card__form">
              <h1 className="display card__title" id="auth-title">
                Link sent
              </h1>
              <p>
                If <b>{email}</b> has a card, a reset link is on its way. It opens back here.
              </p>
              <button type="button" className="btn btn--block" onClick={() => { setMode('sign-in'); setView('email') }}>
                Back to sign in
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
