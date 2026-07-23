import { useMemo, useState } from 'react'

import type { Question } from '../../types.ts'

type SkillMap = Map<string, Question[]>
type DomainMap = Map<string, SkillMap>
type Tree = Map<string, DomainMap> // difficulty → domain → skill → questions

// Groups questions into the Difficulty → Domain → Skill hierarchy the Browse
// screen renders, and tracks which nodes are expanded (by path key).
export function useBrowseTree(questions: Question[]) {
  const tree = useMemo<Tree>(() => {
    const root: Tree = new Map()
    for (const question of questions) {
      const domains = root.get(question.difficulty) ?? new Map<string, SkillMap>()
      const skills = domains.get(question.domain) ?? new Map<string, Question[]>()
      const group = skills.get(question.skill) ?? []
      group.push(question)
      skills.set(question.skill, group)
      domains.set(question.domain, skills)
      root.set(question.difficulty, domains)
    }
    return root
  }, [questions])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return { tree, expanded, toggle }
}
