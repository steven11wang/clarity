// First run, in 洋葱学园's register: the mascot in the middle, one line in a
// speech bubble, big answers underneath. Two taps, then straight into page one —
// first value before any sign-up.

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { updateGame, useGame } from '../game/store.ts'
import { go } from '../router.ts'
import { Logo } from '../components/Logo.tsx'
import { Tangyuan, type Mood } from '../components/Tangyuan.tsx'

const TARGETS = [
  { score: 1400, label: '1400+', note: 'A strong score anywhere' },
  { score: 1500, label: '1500+', note: 'Clears the first cut at most top schools' },
  { score: 1550, label: '1550+', note: 'The middle of a top-30 class' },
]

const MINUTES = [
  { minutes: 5, label: '5 min a day', note: 'One page' },
  { minutes: 10, label: '10 min a day', note: 'Two pages' },
  { minutes: 20, label: '20 min a day', note: 'Four pages' },
]

export function Start() {
  const game = useGame()
  const [step, setStep] = useState(0)

  const lines: Array<{ say: string; mood: Mood }> = [
    { say: 'Hi, I’m 汤圆. What score are you going for?', mood: 'happy' },
    { say: 'How long can you play each day? A page takes about four minutes.', mood: 'think' },
    { say: 'Here’s the deal: anything you miss, I clip into your Mistake Notebook and bring back. Ready for page one?', mood: 'wink' },
  ]

  return (
    <div className="start">
      <header className="start__bar">
        <a href="#/" aria-label="Back to the front page">
          <Logo />
        </a>
        <ol className="start__dots" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={i <= step ? 'is-on' : ''} />
          ))}
        </ol>
        {game.onboarded ? (
          <a className="start__skip" href="#/today">
            Skip
          </a>
        ) : (
          <span />
        )}
      </header>

      <div className="start__stage">
        <p className="speech speech--below start__speech" key={step} aria-live="polite">
          {lines[step].say}
        </p>
        <Tangyuan size={190} mood={lines[step].mood} outfit={step === 2 ? 'scholar' : 'none'} />
      </div>

      <div className="start__answers" key={step}>
        {step === 0 &&
          TARGETS.map((target) => (
            <button
              key={target.score}
              type="button"
              className={`answer-pill ${game.targetScore === target.score ? 'is-on' : ''}`}
              onClick={() => {
                updateGame((state) => ({ ...state, targetScore: target.score }))
                setStep(1)
              }}
            >
              <b className="num">{target.label}</b>
              <span>{target.note}</span>
            </button>
          ))}
        {step === 1 &&
          MINUTES.map((option) => (
            <button
              key={option.minutes}
              type="button"
              className={`answer-pill ${game.dailyMinutes === option.minutes ? 'is-on' : ''}`}
              onClick={() => {
                updateGame((state) => ({ ...state, dailyMinutes: option.minutes }))
                setStep(2)
              }}
            >
              <b>{option.label}</b>
              <span>{option.note}</span>
            </button>
          ))}
        {step === 2 && (
          <button type="button" className="answer-pill answer-pill--go" onClick={() => go('/play/first')}>
            <b>Play page one</b>
            <span>
              Five questions, one from each corner of the test <ArrowRight size={16} />
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
