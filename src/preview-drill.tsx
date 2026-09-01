// Dev-only harness for the Drills screens: the tile and hero in the Practice
// rail, the setup panel behind them, and the full-screen run itself - a drill
// sat in the exam runner, on its own per-question clock. Not part of the
// production build.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { ProgressDashboard } from './components/Adaptive/ProgressDashboard.tsx'
import { DrillPanel } from './components/Drill/DrillPanel.tsx'
import { ExamRunner } from './components/Exam/ExamRunner.tsx'
import { loadQuestions } from './data/questions.ts'
import { drillToPracticeExam } from './drill/examAdapter.ts'
import { DEFAULT_DRILL_SETUP, type DrillSetup } from './drill/setup.ts'
import { SAT_DOMAINS } from './progression/config.ts'
import type { Question } from './types.ts'
import './app.css'
import './components/Exam/exam.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

type Screen = 'shell' | 'setup' | 'run'

const SCREENS: Screen[] = ['shell', 'setup', 'run']

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

  const drillPanel = (
    <DrillPanel
      questions={questions}
      seen={{}}
      setup={setup}
      onChangeSetup={setSetup}
      onStart={() => setScreen('run')}
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

  const drillExam = drillToPracticeExam(
    questions.slice(0, setup.count).map((question) => ({ question, isReview: false })),
    setup,
  )

  return (
    <>
      <div className="exam-overlay" data-exam-theme="dark">
        <ExamRunner
          exam={drillExam.exam}
          learnerName="Preview"
          theme="dark"
          timing={
            setup.secondsPerQuestion === null
              ? { kind: 'untimed', label: 'No clock' }
              : {
                  kind: 'fixed',
                  minutesPerModule: (setup.secondsPerQuestion * setup.count) / 60,
                  label: `${setup.secondsPerQuestion} seconds a question`,
                }
          }
          perQuestionSeconds={setup.secondsPerQuestion}
          persistDraft={false}
          bannerLabel="THIS IS A DRILL"
          onToggleTheme={() => {}}
          onExit={() => setScreen('setup')}
          onFinish={(result) => {
            window.alert(`finished · ${Object.keys(result.answers).length} answered`)
            setScreen('setup')
          }}
        />
      </div>
      <HarnessNav screen={screen} onChange={setScreen} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
