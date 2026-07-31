import { useState, type CSSProperties } from 'react'
import {
  Blend,
  BookOpenText,
  Search,
  WholeWord,
  type LucideIcon,
} from 'lucide-react'

import { CharacterBack } from '../Adaptive/Character.tsx'

import {
  DOMAIN_PRESENTATION,
  SAT_DOMAINS,
  type SatDomain,
} from '../../progression/config.ts'
import { hasSeenLesson } from '../../storage/index.ts'
import {
  SKILL_LESSON_INDEX,
} from '../../content/skillLessons.ts'
import './lesson.css'

type LessonLibraryProps = {
  onSelectSkill: (skill: string) => void
  onBack?: () => void
  recommendedSkill?: string | null
}

type LessonSelection =
  | { kind: 'domain'; domain: SatDomain }

const DOMAIN_ICONS: Record<SatDomain, LucideIcon> = {
  'Information and Ideas': Search,
  'Craft and Structure': BookOpenText,
  'Expression of Ideas': Blend,
  'Standard English Conventions': WholeWord,
}

function lessonForSkill(skill: string | null | undefined) {
  return SKILL_LESSON_INDEX.find((entry) => entry.skill === skill) ?? null
}

export function LessonLibrary({
  onSelectSkill,
  recommendedSkill,
}: LessonLibraryProps) {
  const continueLesson =
    lessonForSkill(recommendedSkill) ?? SKILL_LESSON_INDEX[0]
  const [selection, setSelection] = useState<LessonSelection>({
    kind: 'domain',
    domain: continueLesson.domain as SatDomain,
  })

  const selectedDomain = selection.domain
  const selectedPresentation = DOMAIN_PRESENTATION[selectedDomain]
  const selectedLesson =
    SKILL_LESSON_INDEX.find((lesson) => lesson.domain === selectedDomain) ??
    continueLesson

  return (
    <section className="lesson-portal-room" aria-label="Lessons">
      <div className="lesson-portal-room__light" aria-hidden="true" />
      <div className="lesson-portal-room__doors" aria-label="Lesson collections">
        {SAT_DOMAINS.map((domain) => {
          const presentation = DOMAIN_PRESENTATION[domain]
          const Icon = DOMAIN_ICONS[domain]
          const selected = selection.domain === domain

          return (
            <button
              className="lesson-portal-door"
              type="button"
              key={domain}
              data-domain={domain}
              aria-pressed={selected}
              onClick={() => setSelection({ kind: 'domain', domain })}
              style={{
                '--lesson-accent': presentation.accent,
              } as CSSProperties}
              data-ui-sound="true"
              data-ui-sound-hover="hover"
              data-ui-sound-click="select"
            >
              <span className="lesson-portal-door__frame" aria-hidden="true" />
              <span className="lesson-portal-door__icon" aria-hidden="true">
                <Icon strokeWidth={1.45} />
              </span>
              <span>{presentation.shortName}</span>
            </button>
          )
        })}
      </div>
      <div className="lesson-portal-room__hero" aria-live="polite">
        <header>
          <p>{selectedPresentation.shortName.toUpperCase()} · LESSONS</p>
          <h1 className="lesson-portal-room__title">{selectedDomain}</h1>
          <span>{selectedPresentation.description}</span>
        </header>
        <button className="console-button console-button--primary lesson-portal-room__enter" type="button" onClick={() => onSelectSkill(selectedLesson.skill)}>Enter this path</button>
        <small>{selectedLesson.skill} · {hasSeenLesson(selectedLesson.skill) ? 'Review' : 'Start lesson'}</small>
      </div>
      <div className="lesson-portal-room__floor" aria-hidden="true" />
      <div
        className="lesson-portal-room__figure"
        data-domain={selectedDomain}
        key={selectedDomain}
        aria-hidden="true"
      >
        <CharacterBack domain={selectedDomain} />
      </div>
      <button className="lesson-portal-room__continue" type="button" onClick={() => onSelectSkill(continueLesson.skill)}>
        <span>Continue learning</span><strong>{continueLesson.skill}</strong><em>Resume →</em>
      </button>
    </section>
  )
}
