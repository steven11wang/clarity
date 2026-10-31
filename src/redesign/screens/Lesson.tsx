// A two-minute lesson in 洋葱学园's shape: a character explains one idea in a
// few beats, and a checkpoint question sits in the way — you answer it before
// the lesson lets you finish. The words come from Clarity's own skill index.

import { useEffect, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'

import skillIndex from '../../content/skillLessonIndex.json' with { type: 'json' }
import type { Question } from '../../types.ts'
import { ALL_SKILLS, REWARDS, domainOf, slug } from '../game/content.ts'
import { bumpQuest, completeNode, fileMiss, gain, recordAnswer } from '../game/engine.ts'
import { LETTERS, loadBank, pickPage } from '../game/questions.ts'
import { updateGame, useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { INK_VAR } from '../components/Glyphs.tsx'
import { buzz } from '../components/hooks.ts'
import { QuestionSheet } from '../components/QuestionSheet.tsx'
import { Tangyuan } from '../components/Tangyuan.tsx'
import { play } from '../sound.ts'

type Letter = (typeof LETTERS)[number]
type Entry = { skill: string; nutshell: string; oneMove: string; watchOut: string[] }

const STEPS = ['idea', 'move', 'traps', 'check', 'done'] as const
type Step = (typeof STEPS)[number]

/** strip the index's light markdown (*word*) for plain display */
const plain = (text: string) => text.replace(/\*([^*]+)\*/g, '$1')

export function Lesson({ skillSlug }: { skillSlug: string }) {
  const game = useGame()
  const day = useToday()
  const skill = ALL_SKILLS.find((name) => slug(name) === skillSlug) ?? ALL_SKILLS[0]
  const entry = (skillIndex as Entry[]).find((item) => item.skill === skill)
  const domain = domainOf(skill)
  const [step, setStep] = useState<Step>('idea')
  const [flipped, setFlipped] = useState(0)
  const [question, setQuestion] = useState<Question | null>(null)
  const [wrongs, setWrongs] = useState<Letter[]>([])
  const [picked, setPicked] = useState<Letter | null>(null)
  const [filed, setFiled] = useState(false)

  useEffect(() => {
    void loadBank().then((bank) => setQuestion(pickPage(bank, skill, 'Easy', 1, `lesson:${skill}:${day}`)[0] ?? null))
  }, [skill, day])

  if (!entry) return null
  const index = STEPS.indexOf(step)

  const tryLetter = (letter: Letter) => {
    if (!question) return
    if (letter === question.answer) {
      setPicked(letter)
      buzz(14)
      play('right')
      window.setTimeout(() => play('stamp'), 700)
      updateGame((state) => {
        let next = recordAnswer(state, skill, wrongs.length === 0)
        next = gain(next, REWARDS.lessonXp, 1)
        next = bumpQuest(next, 'finish-lesson')
        next = bumpQuest(next, 'earn-xp', REWARDS.lessonXp)
        return completeNode(next, `${slug(skill)}-lesson`)
      })
      window.setTimeout(() => setStep('done'), 900)
    } else {
      setWrongs((list) => [...list, letter])
      buzz([10, 40, 10])
      play('wrong')
      if (!filed) {
        // a checkpoint miss is still a miss: it comes back like any other
        updateGame((state) => fileMiss(state, question.id, skill, day))
        setFiled(true)
      }
    }
  }

  const say: Record<Step, string> = {
    idea: plain(entry.nutshell),
    move: plain(entry.oneMove),
    traps: 'Three ways this question type catches people. Tap to flip each one.',
    check: wrongs.length === 0 ? 'Checkpoint. Answer this one and the lesson is yours.' : `Not that one — ${plain(entry.watchOut[0] ?? '')}`,
    done: 'Lesson done. The pages for this skill are open on your path.',
  }

  return (
    <div className="lesson" style={{ ['--mark' as string]: INK_VAR[domain.ink] }}>
      <header className="play__bar">
        <button type="button" className="play__leave" onClick={() => go('/path')} aria-label="Leave the lesson">
          <X />
        </button>
        <div className="play__title">
          <b>{skill}</b>
          <span>two-minute lesson</span>
        </div>
        <span className="lesson__progress meter meter--thick" style={{ ['--value' as string]: index / (STEPS.length - 1) }}>
          <span />
        </span>
      </header>

      <div className="lesson__stage">
        <div className="lesson__narrator">
          <Tangyuan outfit={game.outfit === 'none' ? 'specs' : game.outfit} size={step === 'check' ? 92 : 140} mood={step === 'done' ? 'wow' : wrongs.length && step === 'check' ? 'think' : 'happy'} />
          <p className="speech lesson__speech" aria-live="polite" key={step + wrongs.length}>
            {say[step]}
          </p>
        </div>

        <div className="lesson__board sheet sheet--ruled" key={step}>
          {step === 'idea' && (
            <div className="lesson__card">
              <h1 className="display">
                What <span className="hl hl--wrap">{skill}</span> asks
              </h1>
              <p className="lesson__big">{plain(entry.nutshell)}</p>
              <p className="lesson__domain">Part of {domain.name}</p>
            </div>
          )}
          {step === 'move' && (
            <div className="lesson__card">
              <h1 className="display">The one move</h1>
              <p className="lesson__big">
                <span className="lesson__swipe">{plain(entry.oneMove)}</span>
              </p>
            </div>
          )}
          {step === 'traps' && (
            <div className="lesson__card">
              <h1 className="display">Watch out for</h1>
              <ol className="flips">
                {entry.watchOut.slice(0, 3).map((item, i) => (
                  <li key={item}>
                    <button
                      type="button"
                      className={`flip ${i < flipped ? 'is-open' : ''}`}
                      onClick={() => {
                        if (i !== flipped) return
                        play('flip')
                        setFlipped(flipped + 1)
                      }}
                      disabled={i > flipped}
                      aria-pressed={i < flipped}
                    >
                      <span className="flip__front">Trap {i + 1}</span>
                      <span className="flip__back">{plain(item)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {step === 'check' &&
            (question ? (
              <QuestionSheet
                question={question}
                picked={picked}
                onPick={picked ? undefined : tryLetter}
                graded={Boolean(picked)}
                disabledLetters={wrongs}
                struck={wrongs}
                header={
                  <div className="play__tags">
                    <span className="tag">Checkpoint · answer to continue</span>
                  </div>
                }
              />
            ) : (
              <p className="hand">finding a question…</p>
            ))}
          {step === 'done' && (
            <div className="lesson__card lesson__card--done">
              <span className="stamp stamp--big is-landing">+{REWARDS.lessonXp} XP</span>
              <h1 className="display">Lesson cleared.</h1>
              <p>Next stop: {skill} · Easy. Five questions, and they count toward your first star.</p>
            </div>
          )}
        </div>
      </div>

      <footer className="lesson__foot">
        {step === 'idea' && (
          <button type="button" className="btn btn--lg" onClick={() => setStep('move')}>
            Got it <ArrowRight />
          </button>
        )}
        {step === 'move' && (
          <button type="button" className="btn btn--lg" onClick={() => setStep('traps')}>
            Show me the traps <ArrowRight />
          </button>
        )}
        {step === 'traps' && (
          <button type="button" className="btn btn--lg" onClick={() => setStep('check')} disabled={flipped < Math.min(3, entry.watchOut.length)}>
            {flipped < Math.min(3, entry.watchOut.length) ? 'Flip every trap first' : 'Checkpoint'} <ArrowRight />
          </button>
        )}
        {step === 'done' && (
          <>
            <button type="button" className="btn btn--lg" onClick={() => go(`/play/${slug(skill)}-easy`)}>
              Play {skill} · Easy <ArrowRight />
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => go('/path')}>
              Back to the path
            </button>
          </>
        )}
      </footer>
    </div>
  )
}
