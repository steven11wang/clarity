// Dev-only harness for eyeballing the lesson tabs without walking the whole
// onboarding → diagnostic → skill-path flow. Not part of the production build.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { LessonLibrary } from './components/Lesson/LessonLibrary.tsx'
import { SkillLesson } from './components/Lesson/SkillLesson.tsx'
import { SKILL_LESSON_INDEX, getSkillLessonSummary } from './content/skillLessons.ts'
import type { SatDomain } from './progression/config.ts'
import './app.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

function Harness() {
  const params = new URLSearchParams(window.location.search)
  // null shows the library, mirroring the dashboard's Lessons tab.
  const [skill, setSkill] = useState<string | null>(params.get('skill'))
  // Production lifts the open hall so the fullscreen layer knows about it.
  const [hall, setHall] = useState<SatDomain | null>(null)
  if (skill === null) {
    const library = (
      <LessonLibrary
        hall={hall}
        onHallChange={setHall}
        onSelectSkill={setSkill}
        onBack={() => setSkill(null)}
      />
    )
    return hall ? <div className="lesson-fullscreen">{library}</div> : library
  }
  const summary = getSkillLessonSummary(skill)
  if (!summary) return <p>no lesson for {skill}</p>
  // Production opens lessons fullscreen inside the console; mirror that here.
  return (
    <div className="lesson-fullscreen">
      <SkillLesson
        embedded
        key={skill}
        summary={summary}
        finishLabel="Back to all lessons"
        onFinish={() => setSkill(null)}
        onExit={() => setSkill(null)}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
