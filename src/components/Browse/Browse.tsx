import type { Question } from '../../types.ts'

type BrowseProps = { questions: Question[]; onStart: (questions: Question[]) => void }

export function Browse({ questions, onStart }: BrowseProps) {
  const groups = new Map<string, Question[]>()
  for (const question of questions) {
    const key = `${question.test} · ${question.difficulty} · ${question.domain} · ${question.skill}`
    groups.set(key, [...(groups.get(key) ?? []), question])
  }
  return <main className="browse app-shell"><header className="app-header"><a className="wordmark" href="/" aria-label="Clarity home">clarity<span>.</span></a><span className="session-count">Choose a focused set</span></header><section className="browse-intro"><p className="eyebrow">SAT Reading & Writing</p><h1>Practice with intention.</h1><p>Choose a skill below, or begin with the complete set.</p><button className="button" type="button" onClick={() => onStart(questions)}>Start all {questions.length} questions</button></section><section className="browse-list" aria-label="Available practice sets">{[...groups].map(([label, group]) => <button type="button" className="browse-row" key={label} onClick={() => onStart(group)}><span>{label}</span><strong>{group.length} questions <span aria-hidden="true">→</span></strong></button>)}</section></main>
}
