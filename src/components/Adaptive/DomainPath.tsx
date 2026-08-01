import type { CSSProperties } from 'react'

import {
  DOMAIN_PRESENTATION,
  type CharacterStage,
  type Level,
  type SatDomain,
} from '../../progression/config.ts'
import { Character } from './Character.tsx'

export type SkillCardView = {
  name: string
  completed: boolean
  practiceLevel: Level
  remediation: boolean
  checkpointRepair: boolean
  attemptCount: number
  /** False when this skill has no Foundations lesson authored for it. */
  hasLesson: boolean
  /** True once the student has walked the lesson at least once. */
  lessonSeen: boolean
}

export type CheckpointView = {
  level: 'Adventurer' | 'Master'
  status: 'locked' | 'ready' | 'repair-required'
  attempts: number
  repairSkills: string[]
}

type DomainPathProps = {
  domain: SatDomain
  currentLevel: Level
  characterStage: CharacterStage
  entryLevel: Level
  skills: SkillCardView[]
  checkpoint: CheckpointView | null
  finished: boolean
  diagnosticComplete: boolean
  diagnosticAttempts: number
  onBack: () => void
  onStartDiagnostic: () => void
  onStartSkill: (skill: string) => void
  onOpenLesson: (skill: string) => void
  onStartCheckpoint: () => void
}

export function DomainPath({
  domain,
  currentLevel,
  characterStage,
  entryLevel,
  skills,
  checkpoint,
  finished,
  diagnosticComplete,
  diagnosticAttempts,
  onBack,
  onStartDiagnostic,
  onStartSkill,
  onOpenLesson,
  onStartCheckpoint,
}: DomainPathProps) {
  const presentation = DOMAIN_PRESENTATION[domain]
  const completed = skills.filter((skill) => skill.completed).length
  const remainingSkills = skills.length - completed

  return (
    <main
      className="adaptive-shell domain-path"
      style={{
        '--domain-accent': presentation.accent,
        '--domain-soft': presentation.accentSoft,
      } as CSSProperties}
    >
      <header className="adaptive-header">
        <button className="wordmark wordmark--button" type="button" onClick={onBack} aria-label="Back">
          clarity<span>.</span>
        </button>
      </header>

      <section className={`domain-path__hero ${finished ? 'domain-path__hero--finished' : ''}`}>
        <div className="domain-path__character">
          <Character domain={domain} stage={characterStage} />
        </div>
        <div className="domain-path__intro">
          <p className="eyebrow">{finished ? 'Domain complete' : `${currentLevel} training`}</p>
          <h1>{domain}</h1>
          <p>{presentation.description}</p>
          <div className="domain-path__meta">
            <span>Started at <strong>{entryLevel}</strong></span>
            <span><strong>{completed}/{skills.length}</strong> current-level skills</span>
          </div>
          <div
            className="domain-level-progress"
            role="progressbar"
            aria-label={`${completed} of ${skills.length} skills completed`}
            aria-valuemin={0}
            aria-valuemax={skills.length}
            aria-valuenow={completed}
          >
            <div className="domain-level-progress__labels">
              <span>Full diagnostic</span>
              <span>{completed}/{skills.length} skills</span>
              <span>Checkpoint</span>
            </div>
            <div className="domain-level-progress__rail">
              <span className={diagnosticComplete ? 'is-complete' : 'is-current'}>1</span>
              <i className={diagnosticComplete ? 'is-complete' : ''} />
              <span className={completed === skills.length ? 'is-complete' : diagnosticComplete ? 'is-current' : ''}>2</span>
              <i className={completed === skills.length ? 'is-complete' : ''} />
              <span>3</span>
            </div>
          </div>
        </div>
      </section>

      {finished ? (
        <section className="domain-complete">
          <span className="domain-complete__badge" aria-hidden="true">★</span>
          <div>
            <p className="eyebrow">Master checkpoint passed</p>
            <h2>{presentation.characterName} completed this path.</h2>
            <p>Your skill progress is preserved. You can revisit the practice library without resetting this achievement.</p>
          </div>
        </section>
      ) : (
        <>
          {/* No "01" numeral on the gate: it is the only gate on the page, so
              the number counts a series the student never sees. */}
          {!diagnosticComplete && (
            <section className="diagnostic-gate">
              <div>
                <p className="eyebrow">First: the full picture</p>
                <h2>Take the full domain quiz before skill mini quizzes.</h2>
                <p>
                  You’ll answer three questions from every skill, one at a time.
                  This baseline finds what you already know and what Clarity should teach.
                </p>
                {diagnosticAttempts > 0 && <small>Your previous full quiz is saved.</small>}
              </div>
              <button className="button" type="button" onClick={onStartDiagnostic}>
                Start full diagnostic →
              </button>
            </section>
          )}
          <section className="skill-path" aria-labelledby="skill-path-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{currentLevel} skills</p>
                <h2 id="skill-path-title">Build a perfect three.</h2>
              </div>
              <p>
                {diagnosticComplete
                  ? 'The first time you open a skill you get its full lesson; after that it goes straight to three questions. You can reread any lesson from its card.'
                  : 'Complete the full diagnostic above to unlock focused skill lessons.'}
              </p>
            </div>

            <div className="skill-card-grid">
              {skills.map((skill, index) => {
                const active = diagnosticComplete && (skill.remediation || skill.checkpointRepair || !skill.completed)
                let status = skill.completed ? 'Complete at this level' : 'Ready for a 3-question set'
                if (skill.checkpointRepair) status = 'Required before the checkpoint retake'
                if (skill.remediation) {
                  status =
                    skill.practiceLevel === currentLevel
                      ? `Return challenge: earn 3/3 at ${currentLevel}`
                      : `${skill.practiceLevel} reinforcement, then return to ${currentLevel}`
                }

                return (
                  <article
                    className={[
                      'skill-card',
                      skill.completed && !active ? 'skill-card--complete' : '',
                      skill.remediation ? 'skill-card--remediation' : '',
                      skill.checkpointRepair ? 'skill-card--repair' : '',
                    ].filter(Boolean).join(' ')}
                    key={skill.name}
                  >
                    <div className="skill-card__number" aria-hidden="true">
                      {skill.completed && !active ? '✓' : index + 1}
                    </div>
                    <div className="skill-card__copy">
                      <h3>{skill.name}</h3>
                      <p>{status}</p>
                      <small>
                        {skill.attemptCount === 0
                          ? 'No attempts yet'
                          : `${skill.attemptCount} ${skill.attemptCount === 1 ? 'attempt' : 'attempts'}`}
                        {skill.hasLesson && !skill.lessonSeen && diagnosticComplete
                          ? ' · Lesson first'
                          : ''}
                      </small>
                      {skill.hasLesson && skill.lessonSeen && (
                        <button
                          className="skill-card__lesson"
                          type="button"
                          onClick={() => onOpenLesson(skill.name)}
                        >
                          Reread the lesson
                        </button>
                      )}
                    </div>
                    {active ? (
                      <button className="button" type="button" onClick={() => onStartSkill(skill.name)}>
                        {skill.remediation
                          ? `Practice ${skill.practiceLevel}`
                          : skill.checkpointRepair
                            ? 'Repair this skill'
                            : skill.hasLesson && !skill.lessonSeen
                              ? 'Learn, then quiz'
                              : 'Start mini quiz'}
                      </button>
                    ) : skill.completed ? (
                      <span className="skill-card__done">3/3 secured</span>
                    ) : (
                      <span className="skill-card__done skill-card__done--locked">Locked until full quiz</span>
                    )}
                  </article>
                )
              })}
            </div>
          </section>

          {checkpoint && (
            <section className={`checkpoint-panel checkpoint-panel--${checkpoint.status}`}>
              <div>
                <p className="eyebrow">{checkpoint.level} checkpoint</p>
                <h2>
                  {checkpoint.status === 'ready'
                    ? checkpoint.level === 'Adventurer'
                      ? 'Ready to prove you’re an Adventurer?'
                      : 'Ready for the Master challenge?'
                    : checkpoint.status === 'repair-required'
                      ? 'Repair the missed skills, then try again.'
                      : 'Complete every skill to unlock the mixed challenge.'}
                </h2>
                <p>
                  {checkpoint.status === 'ready'
                    ? `Complete this mixed challenge with 100% accuracy to ${
                        checkpoint.level === 'Adventurer' ? 'unlock Master training' : 'finish this domain'
                      }. It includes exactly three questions from every skill.`
                    : checkpoint.status === 'repair-required'
                      ? `Only ${checkpoint.repairSkills.join(', ')} ${
                          checkpoint.repairSkills.length === 1 ? 'needs' : 'need'
                        } another perfect mini quiz. Skills you answered perfectly stay complete.`
                      : 'Your completed skills are safe. Finish the remaining mini quizzes when you’re ready.'}
                </p>
                {checkpoint.attempts > 0 && (
                  <small>{checkpoint.attempts} checkpoint {checkpoint.attempts === 1 ? 'attempt' : 'attempts'}</small>
                )}
              </div>
              <button
                className="button checkpoint-panel__button"
                type="button"
                disabled={checkpoint.status !== 'ready'}
                onClick={onStartCheckpoint}
              >
                {checkpoint.status === 'ready'
                  ? `Start ${checkpoint.level} checkpoint`
                  : checkpoint.status === 'repair-required'
                    ? `${checkpoint.repairSkills.length} ${
                        checkpoint.repairSkills.length === 1 ? 'repair' : 'repairs'
                      } remaining`
                    : `${remainingSkills} ${
                        remainingSkills === 1 ? 'skill' : 'skills'
                      } remaining`}
              </button>
            </section>
          )}
        </>
      )}
    </main>
  )
}
