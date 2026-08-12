// Dev-only harness for eyeballing the word bank without sitting an exam and
// saving a dozen words first. Not part of the production build.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { WordBank } from './components/WordBank/WordBank.tsx'
import { createWordEntry, type WordBankEntry } from './dictionary/wordBank.ts'
import { REVIEW_INTERVALS_MS, RETIRED_STAGE } from './review/schedule.ts'
import { getWordBankEntries, saveWord } from './storage/index.ts'
import './app.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

const NOW = Date.now()

const SAMPLES: Array<[string, string, string, string, number, number]> = [
  [
    'ambivalent',
    'adjective',
    'Having mixed or conflicting feelings about something.',
    'The committee was ambivalent about the proposal.',
    -2 * 60 * 60 * 1000,
    0,
  ],
  [
    'delicate',
    'adjective',
    'Easily damaged or requiring careful handling.',
    'She burns delicate patterns into cutting boards.',
    -30 * 60 * 1000,
    1,
  ],
  [
    'tempered',
    'verb',
    'To moderate or control.',
    'The critic tempered her harsh judgement of the novel.',
    REVIEW_INTERVALS_MS[1],
    2,
  ],
  [
    'apocryphal',
    'adjective',
    'Of doubtful authenticity, or lacking authority; not regarded as canonical.',
    'Her account of the expedition was largely apocryphal.',
    REVIEW_INTERVALS_MS[3],
    3,
  ],
  [
    'laconic',
    'adjective',
    'Using few words; brief to the point of seeming rude.',
    'His laconic reply ended the discussion.',
    0,
    RETIRED_STAGE,
  ],
]

function seed(): void {
  if (getWordBankEntries().length > 0) return
  SAMPLES.forEach(([word, partOfSpeech, definition, sentence, offset, stage]) => {
    const entry: WordBankEntry = {
      ...createWordEntry({ id: word, word, partOfSpeech, definition, sentence }, false, NOW),
      dueAt: NOW + offset,
      stage,
      clears: stage === RETIRED_STAGE ? 4 : Math.max(0, stage),
    }
    saveWord(entry)
  })
}

function Harness() {
  const [seeded] = useState(() => {
    seed()
    return true
  })
  if (!seeded) return <p>seeding…</p>
  return (
    <div className="console-dashboard console-dashboard--reviews">
      <WordBank onBack={() => window.alert('back')} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
