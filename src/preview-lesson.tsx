// Dev-only harness for eyeballing the lesson tabs without walking the whole
// onboarding → diagnostic → skill-path flow. Not part of the production build.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { LessonLibrary } from './components/Lesson/LessonLibrary.tsx'
import { SkillLesson } from './components/Lesson/SkillLesson.tsx'
import { SKILL_LESSON_INDEX, getSkillLessonSummary } from './content/skillLessons.ts'
import './app.css'
import './components/Adaptive/adaptive.css'
import './console-theme-v2.css'

function Harness() {
  const params = new URLSearchParams(window.location.search)
  // null shows the library, mirroring the dashboard's Lessons tab.
  const [skill, setSkill] = useState<string | null>(params.get('skill'))
  if (skill === null) {
    return <LessonLibrary onSelectSkill={setSkill} onBack={() => setSkill(null)} />
  }
  const summary = getSkillLessonSummary(skill)
  if (!summary) return <p>no lesson for {skill}</p>
  return (
    <SkillLesson
      key={skill}
      summary={summary}
      finishLabel="Back to all lessons"
      onFinish={() => setSkill(null)}
      onExit={() => setSkill(null)}
    />
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
