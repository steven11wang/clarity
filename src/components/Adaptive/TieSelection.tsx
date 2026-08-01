import type { CSSProperties } from 'react'

import {
  DOMAIN_PRESENTATION,
  difficultyToLevel,
  type Difficulty,
  type SatDomain,
} from '../../progression/config.ts'
import { Character } from './Character.tsx'
import './adaptive.css'

type TieSelectionProps = {
  candidates: SatDomain[]
  results: Record<SatDomain, Difficulty>
  onSelect(domain: SatDomain): void
}

export function TieSelection({ candidates, results, onSelect }: TieSelectionProps) {
  return (
    <main className="adaptive-shell tie-shell">
      <header className="adaptive-header">
        <span className="wordmark">
          clarity<span>.</span>
        </span>
        <span className="adaptive-header__context">Choose your first focus</span>
      </header>

      <section className="tie-intro" aria-labelledby="tie-title">
        <p className="eyebrow">A true tie</p>
        <h1 id="tie-title">Which character should grow first?</h1>
        <p>
          These domains share your lowest starting level. Choose the one you want to
          strengthen first - you can visit every other domain from your dashboard at any time.
        </p>
      </section>

      <ul className="tie-grid" aria-label="Tied domains">
        {candidates.map((domain, index) => {
          const presentation = DOMAIN_PRESENTATION[domain]
          const difficulty = results[domain]
          const level = difficultyToLevel(difficulty)
          const descriptionId = `tie-domain-description-${index}`

          return (
            <li key={domain}>
              <button
                className="tie-card"
                type="button"
                onClick={() => onSelect(domain)}
                aria-label={`Start with ${domain}, ${difficulty} result, ${level} starting level`}
                aria-describedby={descriptionId}
                style={
                  {
                    '--tie-accent': presentation.accent,
                    '--tie-accent-soft': presentation.accentSoft,
                  } as CSSProperties
                }
              >
                <span className="tie-card__visual">
                  <Character domain={domain} stage={level} />
                </span>
                <span className="tie-card__copy">
                  <span className="tie-card__level">
                    {difficulty} result · {level} start
                  </span>
                  <strong className="tie-card__title">{domain}</strong>
                  <span className="tie-card__character">
                    Meet {presentation.characterName}, your {presentation.characterRole}.
                  </span>
                  <span className="tie-card__description" id={descriptionId}>
                    {presentation.description}
                  </span>
                  <span className="tie-card__cta" aria-hidden="true">
                    Start with {presentation.shortName} →
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="tie-footnote">
        This choice sets a recommendation, not a restriction. All four domains remain open.
      </p>
    </main>
  )
}
