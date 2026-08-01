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
  /**
   * The hall currently open, or null for the four-portal room. Lifted so a
   * round trip through a lesson comes back to the hall it was started from;
   * left undefined the component keeps the stage itself.
   */
  hall?: SatDomain | null
  onHallChange?: (hall: SatDomain | null) => void
}

const DOMAIN_ICONS: Record<SatDomain, LucideIcon> = {
  'Information and Ideas': Search,
  'Craft and Structure': BookOpenText,
  'Expression of Ideas': Blend,
  'Standard English Conventions': WholeWord,
}

function lessonForSkill(skill: string | null | undefined) {
  return SKILL_LESSON_INDEX.find((entry) => entry.skill === skill) ?? null
}

function lessonsForDomain(domain: SatDomain) {
  return SKILL_LESSON_INDEX.filter((entry) => entry.domain === domain)
}

export function LessonLibrary({
  onSelectSkill,
  onBack,
  recommendedSkill,
  hall: hallProp,
  onHallChange,
}: LessonLibraryProps) {
  const continueLesson =
    lessonForSkill(recommendedSkill) ?? SKILL_LESSON_INDEX[0]
  const [selectedDomain, setSelectedDomain] = useState<SatDomain>(
    (hallProp ?? continueLesson.domain) as SatDomain,
  )
  const [ownHall, setOwnHall] = useState<SatDomain | null>(hallProp ?? null)
  const hall = hallProp === undefined ? ownHall : hallProp

  function openHall(next: SatDomain | null) {
    if (next) setSelectedDomain(next)
    setOwnHall(next)
    onHallChange?.(next)
  }

  if (hall) {
    return (
      <LessonSkillPicker
        domain={hall}
        onSelectSkill={onSelectSkill}
        onBack={() => openHall(null)}
      />
    )
  }

  const selectedPresentation = DOMAIN_PRESENTATION[selectedDomain]
  const selectedLessons = lessonsForDomain(selectedDomain)

  return (
    <section className="lesson-portal-room" aria-label="Lessons">
      <div className="lesson-portal-room__light" aria-hidden="true" />
      {onBack ? (
        <button
          className="lesson-portal-room__back"
          type="button"
          onClick={onBack}
          data-ui-sound="true"
          data-ui-sound-hover="hover"
          data-ui-sound-click="open"
        >
          ← Back to your path
        </button>
      ) : null}
      <div className="lesson-portal-room__doors" aria-label="Lesson collections">
        {SAT_DOMAINS.map((domain) => {
          const presentation = DOMAIN_PRESENTATION[domain]
          const Icon = DOMAIN_ICONS[domain]
          const selected = selectedDomain === domain

          return (
            <button
              className="lesson-portal-door"
              type="button"
              key={domain}
              data-domain={domain}
              aria-pressed={selected}
              /* First click picks the door; a second click on the door you are
                 already standing at walks through it. */
              onClick={() => (selected ? openHall(domain) : setSelectedDomain(domain))}
              aria-label={
                selected
                  ? `Enter ${domain}`
                  : `${domain}. Select this hall`
              }
              style={{
                '--lesson-accent': presentation.accent,
              } as CSSProperties}
              data-ui-sound="true"
              data-ui-sound-hover="hover"
              data-ui-sound-click={selected ? 'open' : 'select'}
            >
              <span className="lesson-portal-door__frame" aria-hidden="true">
                <span className="lesson-portal-door__leaf" />
              </span>
              <span className="lesson-portal-door__icon" aria-hidden="true">
                <Icon strokeWidth={1.45} />
              </span>
              <span className="lesson-portal-door__label" aria-hidden="true">
                {presentation.shortName}
                <em>{selected ? 'Enter →' : 'Select'}</em>
              </span>
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
        <button
          className="console-button console-button--primary lesson-portal-room__enter"
          type="button"
          onClick={() => openHall(selectedDomain)}
        >
          Choose a skill
        </button>
        <small>
          {selectedLessons.length} {selectedLessons.length === 1 ? 'lesson' : 'lessons'} in this hall
        </small>
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

function LessonSkillPicker({
  domain,
  onSelectSkill,
  onBack,
}: {
  domain: SatDomain
  onSelectSkill: (skill: string) => void
  onBack: () => void
}) {
  const presentation = DOMAIN_PRESENTATION[domain]
  const Icon = DOMAIN_ICONS[domain]
  const lessons = lessonsForDomain(domain)

  return (
    <section
      className="lesson-skill-picker"
      aria-label={`${domain} lessons`}
      style={{ '--lesson-accent': presentation.accent } as CSSProperties}
    >
      <button
        className="lesson-skill-picker__back"
        type="button"
        onClick={onBack}
        data-ui-sound="true"
        data-ui-sound-hover="hover"
        data-ui-sound-click="open"
      >
        ← All lesson halls
      </button>
      <header className="lesson-skill-picker__hero">
        <span className="lesson-skill-picker__mark" aria-hidden="true">
          <Icon strokeWidth={1.45} />
        </span>
        <p>{presentation.shortName.toUpperCase()} · CHOOSE A SKILL</p>
        <h1 className="lesson-skill-picker__title">{domain}</h1>
        <span>{presentation.description}</span>
      </header>
      <ul className="lesson-skill-picker__list">
        {lessons.map((lesson) => {
          const seen = hasSeenLesson(lesson.skill)
          return (
            <li key={lesson.skill}>
              <button
                className="lesson-skill-card"
                type="button"
                data-skill={lesson.skill}
                onClick={() => onSelectSkill(lesson.skill)}
                data-ui-sound="true"
                data-ui-sound-hover="hover"
                data-ui-sound-click="select"
              >
                <strong>{lesson.skill}</strong>
                <span>{lesson.nutshell}</span>
                <em>
                  {seen ? 'Review lesson' : 'Start learning'} · {lesson.stepCount}{' '}
                  {lesson.stepCount === 1 ? 'step' : 'steps'} →
                </em>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
