import { ArrowLeft } from 'lucide-react'

import { applyRecall, clozeSentence, type WordBankEntry } from '../../dictionary/wordBank.ts'
import { getSettings, now, saveWord } from '../../storage/index.ts'

// The flashcard run over saved words. Shared by the word bank (drill on demand)
// and the daily return (drill what came due today), so both move a word up the
// same ladder in exactly the same way.

export type Drill = {
  queue: WordBankEntry[]
  index: number
  revealed: boolean
  knew: number
}

export function startWordDrill(queue: WordBankEntry[]): Drill | null {
  return queue.length === 0 ? null : { queue, index: 0, revealed: false, knew: 0 }
}

// Persist the recall verdict and step the drill on. Writing here rather than in
// each caller keeps the ladder move and the card advance inseparable.
export function recordDrillAnswer(drill: Drill, knewIt: boolean): Drill {
  saveWord(applyRecall(drill.queue[drill.index], knewIt, getSettings().demoMode, now()))
  return {
    ...drill,
    index: drill.index + 1,
    revealed: false,
    knew: drill.knew + (knewIt ? 1 : 0),
  }
}

export function isDrillFinished(drill: Drill): boolean {
  return drill.index >= drill.queue.length
}

export function WordDrill({
  drill,
  exitLabel = 'Leave the drill',
  onReveal,
  onAnswer,
  onExit,
}: {
  drill: Drill
  exitLabel?: string
  onReveal: () => void
  onAnswer: (knewIt: boolean) => void
  onExit: () => void
}) {
  const entry = drill.queue[drill.index]

  return (
    <section className="wordbank wordbank--drill" aria-label="Word flashcards">
      <button className="wordbank__back" type="button" onClick={onExit}>
        <ArrowLeft aria-hidden="true" />
        {exitLabel}
      </button>
      <p className="wordbank__progress">
        Card {drill.index + 1} of {drill.queue.length}
      </p>

      <div className="wordbank__card">
        {/* The sentence the word was met in, with the word cut out: recall runs
            from context, the way the test will ask for it. */}
        <q className="wordbank__cloze">{clozeSentence(entry)}</q>

        {drill.revealed ? (
          <>
            <strong className="wordbank__prompt">{entry.word}</strong>
            <p className="wordbank__answer">
              <em>{entry.partOfSpeech}</em> {entry.definition}
            </p>
            <div className="wordbank__verdict">
              <button
                className="console-button console-button--secondary"
                type="button"
                onClick={() => onAnswer(false)}
              >
                Didn’t know it
              </button>
              <button
                className="console-button console-button--primary"
                type="button"
                onClick={() => onAnswer(true)}
              >
                Knew it
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="wordbank__ask">Which word goes here, and what does it mean?</p>
            <button className="console-button console-button--primary" type="button" onClick={onReveal}>
              Show the word
            </button>
          </>
        )}
      </div>
    </section>
  )
}
