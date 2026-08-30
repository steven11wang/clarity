import {
  levelFor,
  rankLabel,
  type ArenaProfile,
  type MatchOutcome,
  type RankChange,
  type SideState,
} from '../../arena/model.ts'
import { RankCrest } from './ArenaMarks.tsx'

const HEADLINE: Record<MatchOutcome, string> = {
  win: 'Battle won',
  loss: 'Battle lost',
  draw: 'Dead even',
}

function standingLine(change: RankChange): string {
  if (!change.moved) {
    // A loss at the bottom of the ladder can't cost a star; say so rather than
    // reporting a demotion that did not happen.
    return change.starDelta === 0 ? 'Rank held.' : 'Held at the floor.'
  }
  if (change.starDelta > 0) return change.promoted ? 'Division cleared.' : 'Star earned.'
  return change.demoted ? 'Division lost.' : 'Star lost.'
}

export function ArenaResult({
  outcome,
  mine,
  theirs,
  rivalName,
  rivalIsBot,
  xpGained,
  profile,
  change,
  missed,
  onRematch,
  onReview,
  onExit,
}: {
  outcome: MatchOutcome
  mine: SideState
  theirs: SideState
  rivalName: string
  rivalIsBot: boolean
  xpGained: number
  profile: ArenaProfile
  change: RankChange
  missed: number
  onRematch: () => void
  onReview: () => void
  onExit: () => void
}) {
  const level = levelFor(profile.xp)

  return (
    <section className={`arena-shell arena-result arena-result--${outcome}`}>
      <p className="arena-result__eyebrow">
        {change.promoted ? 'Promotion' : change.demoted ? 'Demotion' : 'Season standing'}
      </p>
      <h1>{HEADLINE[outcome]}</h1>

      <section className="arena-scoreline" aria-label="Final score">
        <div className={`arena-scoreline__side ${outcome === 'win' ? 'is-winner' : ''}`}>
          <p>You</p>
          <strong>{mine.points}</strong>
          <span>
            {mine.correct} of {mine.answered} correct
          </span>
        </div>
        <span className="arena-scoreline__dash" aria-hidden="true">
          -
        </span>
        <div className={`arena-scoreline__side ${outcome === 'loss' ? 'is-winner' : ''}`}>
          <p>
            {rivalName}
            {rivalIsBot ? ' (training)' : ''}
          </p>
          <strong>{theirs.points}</strong>
          <span>{theirs.correct} correct</span>
        </div>
      </section>

      <section className="arena-result__rank">
        <RankCrest rank={profile.rank} size={112} />
        <div>
          <h2>{rankLabel(profile.rank)}</h2>
          <p>{standingLine(change)}</p>
          <p className="arena-result__record">
            {profile.wins}W / {profile.losses}L this season
          </p>
        </div>
      </section>

      <section className="arena-result__xp">
        <div className="arena-xp__head">
          <span>Level {level.level}</span>
          <span>+{xpGained} XP</span>
        </div>
        <div className="arena-xp__track">
          <span style={{ width: `${Math.round((level.into / level.need) * 100)}%` }} />
        </div>
      </section>

      {missed > 0 && (
        <p className="arena-result__vault">
          {missed} {missed === 1 ? 'question' : 'questions'} filed to your review vault. They return in
          a new order until the fix sticks.
        </p>
      )}

      <div className="arena-launch">
        <button className="arena-button arena-button--primary" type="button" onClick={onRematch}>
          Battle again
        </button>
        {missed > 0 && (
          <button className="arena-button" type="button" onClick={onReview}>
            Review the misses
          </button>
        )}
        <button className="arena-button arena-button--quiet" type="button" onClick={onExit}>
          Back to practice
        </button>
      </div>
    </section>
  )
}
