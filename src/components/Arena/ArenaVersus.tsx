import { useEffect, useState } from 'react'

import { COUNTDOWN_SECONDS } from '../../arena/config.ts'
import type { ArenaOpponent, MatchConfig, Rank } from '../../arena/model.ts'
import { FighterAvatar, RankCrest } from './ArenaMarks.tsx'

function groundLabel(config: MatchConfig): string {
  return `${config.domain === 'Mixed' ? 'All domains' : config.domain} · ${
    config.difficulty === 'Mixed' ? 'Any difficulty' : config.difficulty
  }`
}

// Three seconds of nothing to do, on purpose. The countdown is where the match
// stops being a queue and starts being an opponent with a name.
export function ArenaVersus({
  me,
  rival,
  rivalRank,
  config,
  onDone,
}: {
  me: { name: string; avatarId: string; rank: Rank; rankLabel: string }
  rival: ArenaOpponent
  rivalRank: Rank
  config: MatchConfig
  onDone: () => void
}) {
  const [count, setCount] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (count <= 0) {
      const timer = setTimeout(onDone, 420)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setCount((value) => value - 1), 900)
    return () => clearTimeout(timer)
  }, [count, onDone])

  return (
    <section className="arena-shell arena-versus" aria-live="polite">
      <div className="arena-versus__half arena-versus__half--mine" aria-hidden="true" />
      <div className="arena-versus__half arena-versus__half--rival" aria-hidden="true" />
      <p className="arena-versus__mode">{groundLabel(config)}</p>

      <section className="arena-versus__card arena-versus__card--mine">
        <FighterAvatar avatarId={me.avatarId} name={me.name} side="mine" size={104} />
        <h2>{me.name}</h2>
        <div className="arena-versus__rank">
          <RankCrest rank={me.rank} size={44} showStars={false} />
          <span>{me.rankLabel}</span>
        </div>
      </section>

      <div className="arena-versus__count" role="status">
        <span key={count}>{count > 0 ? count : 'GO'}</span>
      </div>

      <section className="arena-versus__card arena-versus__card--rival">
        <FighterAvatar avatarId={rival.avatarId} name={rival.name} side="rival" size={104} />
        <h2>
          {rival.name}
          {rival.isBot ? ' (training)' : ''}
        </h2>
        <div className="arena-versus__rank">
          <RankCrest rank={rivalRank} size={44} showStars={false} />
          <span>{rival.rankLabel}</span>
        </div>
      </section>

      <p className="arena-versus__status">Opponent locked in</p>
    </section>
  )
}
