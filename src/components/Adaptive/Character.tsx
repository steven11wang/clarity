import type { CSSProperties } from 'react'

import {
  DOMAIN_PRESENTATION,
  SAT_DOMAINS,
  type CharacterStage,
  type SatDomain,
} from '../../progression/config.ts'

type CharacterProps = {
  domain: SatDomain
  stage: CharacterStage
}

const FEATURES = [
  { skin: '#8f5f45', hair: '#2f2927' },
  { skin: '#d09a72', hair: '#6c4733' },
  { skin: '#6f4639', hair: '#171b1a' },
  { skin: '#b97858', hair: '#3e2e2a' },
] as const

/** Back view used by the lessons portal room, where the camera sits behind the
 * learner. No face — the point is that you are looking over their shoulder. */
export function CharacterBack({ domain }: { domain: SatDomain }) {
  const index = SAT_DOMAINS.indexOf(domain)
  const { skin, hair } = FEATURES[index]
  const { accent } = DOMAIN_PRESENTATION[domain]

  return (
    <div
      className="domain-character domain-character--back"
      style={{ '--character-accent': accent } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 205" focusable="false">
        <ellipse cx="120" cy="196" rx="52" ry="8" fill="#02060f" opacity=".55" />
        <path d="M106 142v50M134 142v50" fill="none" stroke="#1d2946" strokeWidth="16" strokeLinecap="round" />
        <rect x="110" y="62" width="20" height="20" rx="8" fill={skin} />
        <path d="M120 78c-22 0-36 11-40 27l-6 36c0 8 19 13 46 13s46-5 46-13l-6-36c-4-16-18-27-40-27z" fill={accent} />
        <path d="M84 96l-9 46M156 96l9 46" fill="none" stroke={accent} strokeWidth="14" strokeLinecap="round" />
        <circle cx="74" cy="146" r="7" fill={skin} />
        <circle cx="166" cy="146" r="7" fill={skin} />
        <rect x="96" y="92" width="48" height="54" rx="12" fill="#0d1730" opacity=".92" />
        <path d="M104 92l6-14M136 92l-6-14" stroke="#0d1730" strokeWidth="7" strokeLinecap="round" />
        <rect x="108" y="106" width="24" height="18" rx="5" fill={accent} opacity=".85" />
        <circle cx="120" cy="44" r="31" fill={hair} />
        <path d="M91 50c-2 12 6 22 29 22s31-10 29-22c-4 16-14 24-29 24s-25-8-29-24z" fill={skin} opacity=".35" />
        <circle cx="120" cy="20" r="26" fill="#ffffff" opacity=".05" />
      </svg>
    </div>
  )
}

function CharacterAccessory({ index, accent }: { index: number; accent: string }) {
  if (index === 0) return <><circle cx="177" cy="137" r="15" fill="#e8f3ef" stroke={accent} strokeWidth="3" /><path d="M188 148l12 13" stroke={accent} strokeWidth="5" strokeLinecap="round" /></>
  if (index === 1) return <><path d="M164 119l28 8-7 30-28-8z" fill="#fff8db" stroke={accent} strokeWidth="3" /><path d="M164 133l22 6M162 141l20 6" stroke={accent} strokeWidth="2" /></>
  if (index === 2) return <><rect x="159" y="121" width="36" height="30" rx="5" fill="#fff4e9" stroke={accent} strokeWidth="3" /><path d="M168 136h18M177 127v18" stroke={accent} strokeWidth="3" /></>
  return <><path d="M157 128l18-12 18 12-18 12z" fill="#f3ecfa" stroke={accent} strokeWidth="3" /><path d="M175 140v18" stroke={accent} strokeWidth="3" /><circle cx="175" cy="162" r="4" fill={accent} /></>
}

function YoungCharacter({ accent, skin, hair, index }: typeof FEATURES[number] & { accent: string; index: number }) {
  return (
    <>
      <ellipse cx="120" cy="183" rx="64" ry="11" fill="#d7ded9" />
      <path d="M82 155c15-18 61-18 76 0l-9 27H91z" fill={accent} />
      <path d="M98 168l-24 12M142 168l24 12" fill="none" stroke="#34433f" strokeWidth="9" strokeLinecap="round" />
      <circle cx="120" cy="104" r="35" fill={skin} />
      <path d="M88 102c0-28 14-42 34-42 20 0 32 13 33 37-11-7-23-12-37-12-9 0-19 6-30 17z" fill={hair} />
      <circle cx="108" cy="107" r="2.8" fill="#263238" />
      <circle cx="132" cy="107" r="2.8" fill="#263238" />
      <path d="M113 121c5 4 10 4 15 0" fill="none" stroke="#6e4034" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M94 145c11-11 41-11 52 0v29H94z" fill={accent} />
      <path d="M106 151h28v20h-28z" fill="#f7f1df" stroke="#52635f" strokeWidth="2" />
      <path d="M120 151v20" stroke="#a6ada7" strokeWidth="1.5" />
      <CharacterAccessory index={index} accent={accent} />
    </>
  )
}

function StandingCharacter({
  accent,
  skin,
  hair,
  master,
  completed,
  index,
}: typeof FEATURES[number] & { accent: string; master: boolean; completed: boolean; index: number }) {
  return (
    <>
      {completed && <circle cx="120" cy="102" r="92" fill={accent} opacity=".12" />}
      <ellipse cx="120" cy="190" rx={completed ? 79 : 65} ry="10" fill={completed ? accent : '#d7ded9'} opacity={completed ? '.32' : '1'} />
      {master && <path d="M83 91c-19 22-25 53-16 83l30-17 46 4 31 15c6-34-2-61-19-82z" fill={accent} opacity=".34" />}
      <path d="M100 137l-7 48M140 137l7 48" fill="none" stroke="#34433f" strokeWidth="11" strokeLinecap="round" />
      <path d="M86 83c-10 8-14 31-8 47l16-7V88z" fill={master ? '#3d4d49' : '#7a8b86'} />
      <path d="M94 83c12-12 40-12 52 0l7 67H87z" fill={accent} />
      {master && <path d="M116 81h9l6 69h-19z" fill="#f0d994" opacity=".8" />}
      <circle cx="120" cy="57" r="31" fill={skin} />
      <path d="M91 58c1-27 14-40 31-40 19 0 30 12 31 35-10-7-20-11-32-11-11 0-20 5-30 16z" fill={hair} />
      <circle cx="109" cy="59" r="2.6" fill="#263238" />
      <circle cx="131" cy="59" r="2.6" fill="#263238" />
      <path d="M113 71c5 4 10 4 15 0" fill="none" stroke="#6e4034" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M91 98l-22 32M149 98l23 25" fill="none" stroke={skin} strokeWidth="10" strokeLinecap="round" />
      {master ? (
        <>
          <circle cx="175" cy="126" r="14" fill="#f4e6b5" stroke="#8b6d28" strokeWidth="3" />
          <path d="M175 113v26M162 126h26" stroke="#8b6d28" strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M164 116l19 10-13 23-19-10z" fill="#f7f1df" stroke="#52635f" strokeWidth="2" />
          <path d="M168 126l7 4" stroke="#49746b" strokeWidth="2" />
        </>
      )}
      {completed && (
        <g>
          <circle cx="183" cy="43" r="25" fill="#f4d36a" stroke="#9a7820" strokeWidth="3" />
          <path d="M183 28l5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2z" fill="#fff7d6" />
        </g>
      )}
      {!master && <CharacterAccessory index={index} accent={accent} />}
    </>
  )
}

export function Character({ domain, stage }: CharacterProps) {
  const index = SAT_DOMAINS.indexOf(domain)
  const features = FEATURES[index]
  const presentation = DOMAIN_PRESENTATION[domain]
  const isYoung = stage === 'Noobie'
  const isMaster = stage === 'Master' || stage === 'Completed'

  return (
    <div
      className={`domain-character domain-character--${stage.toLowerCase()}`}
      style={{ '--character-accent': presentation.accent } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 205" focusable="false">
        {isYoung ? (
          <YoungCharacter {...features} accent={presentation.accent} index={index} />
        ) : (
          <StandingCharacter
            {...features}
            accent={presentation.accent}
            master={isMaster}
            completed={stage === 'Completed'}
            index={index}
          />
        )}
      </svg>
    </div>
  )
}
