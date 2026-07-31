import { useMemo, useState, type CSSProperties } from 'react'
import {
  Blend,
  BookOpenText,
  Search,
  WholeWord,
  type LucideIcon,
} from 'lucide-react'

import {
  DOMAIN_PRESENTATION,
  SAT_DOMAINS,
  type SatDomain,
} from '../../progression/config.ts'
import { hasSeenLesson } from '../../storage/index.ts'
import {
  SKILL_LESSON_INDEX,
  type SkillLessonSummary,
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

  const visibleLessons = useMemo(
    () =>
      SKILL_LESSON_INDEX.filter(
        (entry) => entry.domain === selection.domain,
      ),
    [selection],
  )

  const selectedDomain = selection.domain
  const selectedPresentation = DOMAIN_PRESENTATION[selectedDomain]

  return (
    <section className="lesson-console" aria-label="Lessons">
      <div className="lesson-console__rail" aria-label="Lesson collections">
        {SAT_DOMAINS.map((domain) => {
          const presentation = DOMAIN_PRESENTATION[domain]
          const Icon = DOMAIN_ICONS[domain]
          const selected = selection.domain === domain

          return (
            <button
              className="lesson-console__tile"
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
              <span className="lesson-console__tile-icon" aria-hidden="true">
                <Icon strokeWidth={1.45} />
              </span>
              <span>{presentation.shortName}</span>
            </button>
          )
        })}
      </div>

      <div className="lesson-console__detail" aria-live="polite">
        <header className="lesson-console__detail-head">
          <p>{selectedPresentation.shortName.toUpperCase()} · LESSONS</p>
          <h1>{selectedDomain}</h1>
          <span>{selectedPresentation.description}</span>
        </header>
        <div className="lesson-console__lesson-list">
          {visibleLessons.map((lesson, index) => (
            <LessonRow
              lesson={lesson}
              index={index}
              key={lesson.skill}
              onSelectSkill={onSelectSkill}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function LessonRow({
  lesson,
  index,
  onSelectSkill,
}: {
  lesson: SkillLessonSummary
  index: number
  onSelectSkill: (skill: string) => void
}) {
  const seen = hasSeenLesson(lesson.skill)

  return (
    <button
      className="lesson-console__lesson-row"
      type="button"
      data-domain={lesson.domain}
      data-skill={lesson.skill}
      onClick={() => onSelectSkill(lesson.skill)}
      data-ui-sound="true"
      data-ui-sound-hover="hover"
      data-ui-sound-click="open"
    >
      <span className="lesson-console__lesson-index">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="lesson-console__lesson-copy">
        <strong>{lesson.skill}</strong>
        <small>{lesson.nutshell}</small>
      </span>
      <span className="lesson-console__lesson-state">
        {seen ? 'Review' : 'Start'}
      </span>
    </button>
  )
}
