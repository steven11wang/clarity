// Dev-only harness for eyeballing the Arena without a second player. Realtime
// is never reached here, so every match runs against the scripted training
// opponent - which is also the only path that can be driven end to end alone.
// Not part of the production build.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { Arena } from './components/Arena/Arena.tsx'
import { AuthProfileProvider } from './auth/AuthContext.tsx'
import { loadQuestions } from './data/questions.ts'
import type { Question } from './types.ts'
import './app.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

function Harness() {
  const [questions, setQuestions] = useState<Question[]>([])
  useEffect(() => {
    void loadQuestions().then(setQuestions)
  }, [])
  if (questions.length === 0) return <p>loading questions…</p>

  return (
    <AuthProfileProvider
      value={{
        email: 'preview@example.com',
        displayName: 'Preview',
        isLocal: true,
        signOut: null,
        openAccount: () => {},
        profileId: 'preview',
        avatarId: 'spark',
      }}
    >
      <div className="console-dashboard console-dashboard--arena">
        <Arena
          questions={questions}
          onExit={() => window.alert('back to practice')}
          onOpenReviews={() => window.alert('open the vault')}
          onBattleComplete={(matchId, answers) =>
            console.info('battle complete', matchId, answers)
          }
        />
      </div>
    </AuthProfileProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
