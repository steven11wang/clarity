// Dev-only harness for the Drills screens: the tile and hero in the Practice
// rail, the setup panel behind them, and the verdict beat that lands between
// two drill questions. Not part of the production build.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { ProgressDashboard } from './components/Adaptive/ProgressDashboard.tsx'
import { DrillPanel } from './components/Drill/DrillPanel.tsx'
import { DrillVerdict } from './components/Drill/DrillVerdict.tsx'
import { loadQuestions } from './data/questions.ts'
import { DEFAULT_DRILL_SETUP, type DrillSetup } from './drill/setup.ts'
import { SAT_DOMAINS } from './progression/config.ts'
import type { Question } from './types.ts'
import './app.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

type Screen = 'shell' | 'setup' | 'correct' | 'missed'

const SCREENS: Screen[] = ['shell', 'setup', 'correct', 'missed']

const CARDS = SAT_DOMAINS.map((domain, index) => ({
  domain,
  characterStage: 'Noobie' as const,
  currentLevel: 'Noobie' as const,
  completedSkills: index,
  totalSkills: 4,
  checkpointStatus: index === 0 ? 'Ready' : `${4 - index} skills to go`,
  recommended: index === 1,
  chosen: index === 0,
  finished: false,
}))

function HarnessNav({
  screen,
  onChange,
}: {
  screen: Screen
  onChange: (screen: Screen) => void
}) {
  return (
    <nav
      style={{
        display: 'flex',
        gap: '0.4rem',
        left: '50%',
        position: 'fixed',
        bottom: '1rem',
        transform: 'translateX(-50%)',
        zIndex: 40,
      }}
    >
      {SCREENS.map((option) => (
        <button
          key={option}
          className={`drill-option ${screen === option ? 'drill-option--on' : ''}`}
          type="button"
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </nav>
  )
}

function Harness() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [setup, setSetup] = useState<DrillSetup>(DEFAULT_DRILL_SETUP)
  const [screen, setScreen] = useState<Screen>('shell')

  useEffect(() => {
    void loadQuestions().then(setQuestions)
  }, [])

  if (questions.length === 0) return <p>loading questions…</p>

  const sample = questions[0]
  const wrongLetter = (['A', 'B', 'C', 'D'] as const).find(
    (letter) => letter !== sample.answer,
  )!

  const drillPanel = (
    <DrillPanel
      questions={questions}
      seen={{}}
      setup={setup}
      onChangeSetup={setSetup}
      onStart={(next, drillQuestions) =>
        window.alert(`start ${drillQuestions.length} questions · ${next.domain}`)
      }
      onBack={() => setScreen('shell')}
      onOpenVault={() => window.alert('vault')}
      vaultOpenCount={12}
    />
  )

  if (screen === 'shell' || screen === 'setup') {
    return (
      <>
        <ProgressDashboard
          activeView={screen === 'setup' ? 'drill' : 'practice'}
          examPanel={null}
          drillPanel={drillPanel}
          lessonsPanel={null}
          reviewsPanel={null}
          wordsPanel={null}
          libraryPanel={null}
          reflectPanel={null}
          arenaPanel={null}
          cards={CARDS}
          onSelectDomain={() => {}}
          onUpdateScore={() => {}}
          onOpenPractice={() => setScreen('shell')}
          onOpenDrill={() => setScreen('setup')}
          onOpenVault={() => window.alert('vault')}
          onOpenExam={() => {}}
          onOpenLessons={() => {}}
          onOpenWords={() => {}}
          onOpenLibrary={() => {}}
          onOpenReflect={() => {}}
          onOpenArena={() => {}}
        />
        <HarnessNav screen={screen} onChange={setScreen} />
      </>
    )
  }

  return (
    <div className="console-dashboard console-dashboard--drill">
      <main className="app-shell">
        <DrillVerdict
          question={sample}
          isReview={false}
          firstPass={{
            chosen: screen === 'correct' ? sample.answer : wrongLetter,
            confidence: null,
            correct: screen === 'correct',
            timeMs: 41_000,
            timedOut: false,
            struckChoices: [],
          }}
          position={4}
          total={10}
          correctSoFar={screen === 'correct' ? 4 : 3}
          onContinue={() => setScreen('shell')}
        />
      </main>
      <HarnessNav screen={screen} onChange={setScreen} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
