import { useMemo, useState, type CSSProperties } from 'react'
import {
  Blend,
  BookOpenText,
  Play,
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
  | { kind: 'continue' }
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
  const [selection, setSelection] = useState<LessonSelection>({
    kind: 'continue',
  })
  const continueLesson =
    lessonForSkill(recommendedSkill) ?? SKILL_LESSON_INDEX[0]

  const visibleLessons = useMemo(
    () =>
      selection.kind === 'domain'
        ? SKILL_LESSON_INDEX.filter(
            (entry) => entry.domain === selection.domain,
          )
        : [continueLesson],
    [continueLesson, selection],
  )

  const selectedDomain =
    selection.kind === 'domain' ? selection.domain : null
  const selectedPresentation = selectedDomain
    ? DOMAIN_PRESENTATION[selectedDomain]
    : null

  return (
    <section className="lesson-console" aria-label="Lessons">
      <div className="lesson-console__rail" aria-label="Lesson collections">
        <button
          className="lesson-console__tile lesson-console__tile--continue"
          type="button"
          aria-pressed={selection.kind === 'continue'}
          onClick={() => setSelection({ kind: 'continue' })}
          style={{ '--lesson-accent': '#2b5bc7' } as CSSProperties}
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="select"
        >
          <span className="lesson-console__tile-icon" aria-hidden="true">
            <Play strokeWidth={1.55} />
          </span>
          <span>Continue learning</span>
        </button>

        {SAT_DOMAINS.map((domain) => {
          const presentation = DOMAIN_PRESENTATION[domain]
          const Icon = DOMAIN_ICONS[domain]
          const selected =
            selection.kind === 'domain' && selection.domain === domain

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
        {selection.kind === 'continue' ? (
          <ContinueLesson
            lesson={continueLesson}
            onSelectSkill={onSelectSkill}
          />
        ) : (
          <>
            <header className="lesson-console__detail-head">
              <p>{selectedPresentation?.shortName.toUpperCase()} · LESSONS</p>
              <h1>{selectedDomain}</h1>
              <span>{selectedPresentation?.description}</span>
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
          </>
        )}
      </div>
    </section>
  )
}

function ContinueLesson({
  lesson,
  onSelectSkill,
}: {
  lesson: SkillLessonSummary
  onSelectSkill: (skill: string) => void
}) {
  const presentation =
    DOMAIN_PRESENTATION[lesson.domain as SatDomain]

  return (
    <article className="lesson-console__continue">
      <p>{presentation.shortName.toUpperCase()} · CONTINUE LEARNING</p>
      <h1>{lesson.skill}</h1>
      <span>{lesson.nutshell}</span>
      <button
        className="console-button console-button--primary"
        type="button"
        onClick={() => onSelectSkill(lesson.skill)}
        data-ui-sound="true"
        data-ui-sound-hover="hover"
        data-ui-sound-click="open"
      >
        {hasSeenLesson(lesson.skill) ? 'Continue lesson' : 'Start lesson'}
      </button>
    </article>
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
