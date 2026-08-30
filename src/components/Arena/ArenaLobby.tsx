import { Link2, Swords, Timer, Zap } from 'lucide-react'

import { DIFFICULTY_CHOICES, QUESTIONS_PER_BATTLE, type ArenaMode } from '../../arena/config.ts'
import {
  levelFor,
  rankLabel,
  seasonLabel,
  type ArenaProfile,
  type MatchHistoryEntry,
} from '../../arena/model.ts'
import { RankCrest } from './ArenaMarks.tsx'

const MODES: Array<{ id: ArenaMode; label: string; blurb: string; Mark: typeof Swords }> = [
  {
    id: 'ranked',
    label: 'Ranked duel',
    blurb: 'Pick the ground. Five questions, one star on the line.',
    Mark: Swords,
  },
  {
    id: 'blitz',
    label: 'Blitz scramble',
    blurb: 'Every domain, every difficulty, drawn at random.',
    Mark: Zap,
  },
  {
    id: 'overreach',
    label: 'Overreach',
    blurb: 'Hard only, against someone above you. Win takes two stars.',
    Mark: Timer,
  },
]

export function ArenaLobby({
  profile,
  history,
  domains,
  mode,
  domain,
  difficulty,
  poolCount,
  liveAvailable,
  onModeChange,
  onDomainChange,
  onDifficultyChange,
  onStart,
  onInvite,
}: {
  profile: ArenaProfile
  history: MatchHistoryEntry[]
  domains: string[]
  mode: ArenaMode
  domain: string
  difficulty: string
  poolCount: number
  liveAvailable: boolean
  onModeChange: (mode: ArenaMode) => void
  onDomainChange: (domain: string) => void
  onDifficultyChange: (difficulty: string) => void
  onStart: () => void
  onInvite: () => void
}) {
  const level = levelFor(profile.xp)
  // Blitz and Overreach set their own ground, so the pickers go inert rather
  // than disappearing - the filter you would get is still worth seeing.
  const pickersLocked = mode !== 'ranked'
  const enoughQuestions = poolCount >= QUESTIONS_PER_BATTLE

  return (
    <section className="arena-shell arena-lobby">
      <header className="arena-lobby__intro">
        <div>
          <p className="arena-lobby__eyebrow">Competitive practice</p>
          <h1>Enter the Arena.</h1>
          <p className="arena-lobby__lede">
            Five SAT questions. Your accuracy and pace decide the match.
          </p>
        </div>
        <p className="arena-lobby__season">{seasonLabel(profile.seasonId)}</p>
      </header>

      <div className="arena-lobby__body">
        <aside className="arena-rankcard">
          <RankCrest rank={profile.rank} size={128} />
          <h2>{rankLabel(profile.rank)}</h2>
          <p className="arena-rankcard__record">
            {profile.wins}W / {profile.losses}L
            {profile.streak > 1 ? ` / ${profile.streak} in a row` : ''}
          </p>
          <div className="arena-xp" aria-label={`Level ${level.level}, ${level.into} of ${level.need} XP`}>
            <div className="arena-xp__head">
              <span>Level {level.level}</span>
              <span>
                {level.into} / {level.need} XP
              </span>
            </div>
            <div className="arena-xp__track">
              <span style={{ width: `${Math.round((level.into / level.need) * 100)}%` }} />
            </div>
          </div>
          {!liveAvailable && (
            <p className="arena-rankcard__note">
              Offline mode. You will face a paced training opponent.
            </p>
          )}
        </aside>

        <section className="arena-modes" aria-label="Battle modes">
          <div className="arena-mode-row">
            {MODES.map((entry) => (
              <button
                className={`arena-mode ${mode === entry.id ? 'arena-mode--active' : ''}`}
                type="button"
                key={entry.id}
                onClick={() => onModeChange(entry.id)}
                aria-pressed={mode === entry.id}
                data-ui-sound="true"
                data-ui-sound-hover="hover"
                data-ui-sound-click="select"
              >
                <entry.Mark size={20} strokeWidth={1.5} absoluteStrokeWidth />
                <strong>{entry.label}</strong>
                <span>{entry.blurb}</span>
              </button>
            ))}
          </div>

          <div className="arena-picker">
            <p className="arena-picker__label">Domain</p>
            <div className="arena-chiprow">
              {['Mixed', ...domains].map((entry) => (
                <button
                  className={`arena-chip ${domain === entry ? 'arena-chip--active' : ''}`}
                  type="button"
                  key={entry}
                  disabled={pickersLocked}
                  onClick={() => onDomainChange(entry)}
                  aria-pressed={domain === entry}
                  data-ui-sound="true"
                  data-ui-sound-hover="hover"
                  data-ui-sound-click="select"
                >
                  {entry === 'Mixed' ? 'All domains' : entry}
                </button>
              ))}
            </div>
            <p className="arena-picker__label">Difficulty</p>
            <div className="arena-chiprow">
              {DIFFICULTY_CHOICES.map((entry) => (
                <button
                  className={`arena-chip ${difficulty === entry ? 'arena-chip--active' : ''}`}
                  type="button"
                  key={entry}
                  disabled={pickersLocked}
                  onClick={() => onDifficultyChange(entry)}
                  aria-pressed={difficulty === entry}
                  data-ui-sound="true"
                  data-ui-sound-hover="hover"
                  data-ui-sound-click="select"
                >
                  {entry === 'Mixed' ? 'Any' : entry}
                </button>
              ))}
            </div>
            <p className="arena-picker__pool">
              {enoughQuestions
                ? `${poolCount} questions in this pool. ${QUESTIONS_PER_BATTLE} per battle.`
                : 'Not enough questions in this pool yet. Widen the filter.'}
            </p>
          </div>

          <div className="arena-launch">
            <button
              className="arena-button arena-button--primary"
              type="button"
              onClick={onStart}
              disabled={!enoughQuestions}
              data-ui-sound="true"
              data-ui-sound-hover="hover"
              data-ui-sound-click="open"
            >
              Find an opponent
            </button>
            <button
              className="arena-button"
              type="button"
              onClick={onInvite}
              disabled={!enoughQuestions || !liveAvailable}
              data-ui-sound="true"
              data-ui-sound-hover="hover"
              data-ui-sound-click="select"
            >
              <Link2 size={17} strokeWidth={1.6} absoluteStrokeWidth />
              Invite a friend
            </button>
          </div>

          <div className="arena-history">
            <p className="arena-picker__label">Recent battles</p>
            {history.length > 0 ? (
              <ul>
                {history.slice(0, 5).map((entry) => (
                  <li className={`arena-history__row arena-history__row--${entry.outcome}`} key={entry.matchId}>
                    <span className="arena-history__badge">
                      {entry.outcome === 'win' ? 'W' : entry.outcome === 'loss' ? 'L' : 'D'}
                    </span>
                    <span className="arena-history__name">
                      {entry.opponentName}
                      {entry.opponentIsBot ? ' (training)' : ''}
                    </span>
                    <span className="arena-history__score">
                      {entry.points}-{entry.opponentPoints}
                    </span>
                    <span className="arena-history__xp">+{entry.xpGained} XP</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="arena-history__empty">
                Your match record will appear here after your first battle.
              </p>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
