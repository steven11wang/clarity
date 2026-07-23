import { useBrowseTree } from './useBrowseTree.ts'
import type { Question } from '../../types.ts'

type BrowseProps = {
  questions: Question[]
  dueCount: number
  timedMode: boolean
  timeLimitSec: number
  onToggleTimed: () => void
  onChangeLimit: (sec: number) => void
  onStart: (questions: Question[]) => void
  onOpenDashboard: () => void
}

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard']
const TIME_LIMITS = [60, 90, 120]

export function Browse({
  questions,
  dueCount,
  timedMode,
  timeLimitSec,
  onToggleTimed,
  onChangeLimit,
  onStart,
  onOpenDashboard,
}: BrowseProps) {
  const { tree, expanded, toggle } = useBrowseTree(questions)

  return (
    <main className="browse app-shell">
      <header className="app-header">
        <span className="wordmark">clarity<span>.</span></span>
        <button className="link-button" type="button" onClick={onOpenDashboard}>Dashboard</button>
      </header>

      <section className="browse-intro">
        <p className="eyebrow">SAT Reading &amp; Writing</p>
        <h1>Practice with intention.</h1>
        <p>Every wrong answer becomes a diagnosed, re-tested lesson. Choose a focus, or take the mix.</p>
        {dueCount > 0 && (
          <button className="due-banner" type="button" onClick={() => onStart(questions)}>
            <strong>{dueCount}</strong> {dueCount === 1 ? 'question is' : 'questions are'} due to resurface — they’re woven into any set you start.
          </button>
        )}
        <button className="button" type="button" onClick={() => onStart(questions)}>
          Start the mix — {questions.length} questions
        </button>

        <div className="timed-control">
          <label className="timed-toggle">
            <input type="checkbox" checked={timedMode} onChange={onToggleTimed} />
            <span><strong>Timed mode</strong> — a clock runs while you answer; run out and the question moves on and comes back later.</span>
          </label>
          {timedMode && (
            <div className="timed-limits" role="group" aria-label="Time per question">
              {TIME_LIMITS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`pill ${timeLimitSec === sec ? 'pill--on' : ''}`}
                  onClick={() => onChangeLimit(sec)}
                >
                  {sec}s
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="browse-tree" aria-label="Browse by skill">
        {DIFFICULTY_ORDER.filter((d) => tree.has(d)).map((difficulty) => {
          const domains = tree.get(difficulty)!
          const diffCount = countTree(domains)
          const diffKey = difficulty
          return (
            <div className="tree-block" key={difficulty}>
              <div className="tree-row tree-row--l1">
                <button className="tree-label" type="button" aria-expanded={expanded.has(diffKey)} onClick={() => toggle(diffKey)}>
                  <span className="tree-caret" aria-hidden="true">{expanded.has(diffKey) ? '▾' : '▸'}</span>
                  {difficulty}
                  <span className="tree-count">{diffCount}</span>
                </button>
                <button className="tree-go" type="button" onClick={() => onStart(flatten(domains))}>Practice →</button>
              </div>

              {expanded.has(diffKey) &&
                [...domains].map(([domain, skills]) => {
                  const domainKey = `${difficulty}/${domain}`
                  const domCount = countMap(skills)
                  return (
                    <div className="tree-domain" key={domain}>
                      <div className="tree-row tree-row--l2">
                        <button className="tree-label" type="button" aria-expanded={expanded.has(domainKey)} onClick={() => toggle(domainKey)}>
                          <span className="tree-caret" aria-hidden="true">{expanded.has(domainKey) ? '▾' : '▸'}</span>
                          {domain}
                          <span className="tree-count">{domCount}</span>
                        </button>
                        <button className="tree-go" type="button" onClick={() => onStart([...skills.values()].flat())}>Practice →</button>
                      </div>

                      {expanded.has(domainKey) &&
                        [...skills].map(([skill, group]) => (
                          <div className="tree-row tree-row--l3" key={skill}>
                            <span className="tree-label tree-label--leaf">
                              {skill}
                              <span className="tree-count">{group.length}</span>
                            </span>
                            <button className="tree-go" type="button" onClick={() => onStart(group)}>Practice →</button>
                          </div>
                        ))}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </section>
    </main>
  )
}

type SkillMap = Map<string, Question[]>
type DomainMap = Map<string, SkillMap>

function countMap(skills: SkillMap): number {
  let total = 0
  for (const group of skills.values()) total += group.length
  return total
}

function countTree(domains: DomainMap): number {
  let total = 0
  for (const skills of domains.values()) total += countMap(skills)
  return total
}

function flatten(domains: DomainMap): Question[] {
  const out: Question[] = []
  for (const skills of domains.values()) for (const group of skills.values()) out.push(...group)
  return out
}
