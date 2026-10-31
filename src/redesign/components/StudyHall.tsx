// The Study Hall: a chat for students who are studying right now. Four quick
// phrases, 汤圆 stickers, or a typed message — checked before it's sent and
// again when it arrives. Every message can be reported or its sender hidden.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { EyeOff, Flag, Hand, Heart, Send, ShieldCheck, Smile, Swords, UserPlus, Users } from 'lucide-react'

import { MAX_LENGTH } from '../game/chatModeration.ts'
import type { OutfitId } from '../game/content.ts'
import { PHRASES, STICKERS, phraseText, signedIn, type HallMessage, type useHall } from '../game/hall.ts'
import { liveMode } from '../game/live.ts'
import { updateGame, useGame, useToday } from '../game/store.ts'
import { go } from '../router.ts'
import { play } from '../sound.ts'
import { FounderBadge } from './FounderCode.tsx'
import { Tangyuan } from './Tangyuan.tsx'
import './studyHallChat.css'

type Hall = ReturnType<typeof useHall>

function clock(at: number) {
  return new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function StudyHall({ hall, onChallenge, visible = true }: { hall: Hall; onChallenge: (peerId: string) => void; visible?: boolean }) {
  const game = useGame()
  const day = useToday()
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<{ kind: 'error' | 'care' | 'done'; text: string } | null>(null)
  const [stickers, setStickers] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const list = useRef<HTMLOListElement>(null)
  const online = liveMode() === 'online'
  const canType = !online || signedIn()
  const others = hall.peers.filter((peer) => peer.id !== hall.me?.id)
  const friendIds = new Set((game.friends ?? []).map((friend) => friend.id))
  const messages = [...hall.feed].reverse() // oldest first, newest at the bottom
  const founders = new Set(hall.peers.filter((peer) => peer.founder === true).map((peer) => peer.id))

  // keep the newest message in view, including when the tab comes back
  useEffect(() => {
    const box = list.current
    if (box && visible) box.scrollTop = box.scrollHeight
  }, [hall.feed.length, visible])

  const cool = () => {
    play('emote')
    setCooldown(true)
    window.setTimeout(() => setCooldown(false), 2500)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const verdict = hall.sayText(draft)
    if (verdict.ok) {
      setDraft('')
      setNote(null)
      cool()
      return
    }
    setNote({ kind: verdict.reason === 'care' ? 'care' : 'error', text: verdict.message })
    if (verdict.reason === 'care') setDraft('')
    else play('wrong')
  }

  const report = (message: HallMessage) => {
    hall.report(message)
    setNote({ kind: 'done', text: `Reported. ${message.from.name} is hidden for you${online && signedIn() ? ', and the message was sent for review' : ''}.` })
    play('clip')
  }

  return (
    <div className="study">
      <section className="chat sheet" aria-labelledby="chat-title">
        <header className="chat__head">
          <h2 className="title" id="chat-title">
            Study Hall
          </h2>
          <span className="chat__count">
            <Users size={16} /> <b className="num">{hall.peers.length}</b> here now
          </span>
        </header>

        <ol className="chat__list" ref={list} aria-label="Messages" aria-live="polite">
          {messages.length === 0 && (
            <li className="chat__empty">
              <Tangyuan size={72} mood="wink" />
              <p>
                {others.length > 0
                  ? 'Quiet in here. Say good luck to someone.'
                  : online
                    ? 'Nobody else is here yet. Say hi to whoever comes next.'
                    : 'Only you here. This preview server connects tabs on this computer — open the Arena in a second tab to chat with yourself.'}
              </p>
            </li>
          )}
          {messages.map((message) => {
            const mine = message.from.id === hall.me?.id
            const sticker = message.kind === 'sticker' ? STICKERS.find((item) => item.id === message.value) : null
            if (message.kind === 'cheer') {
              const target = hall.peers.find((peer) => peer.id === message.to)
              return (
                <li key={message.key} className="chat__event">
                  <Hand size={14} /> <b>{mine ? 'You' : message.from.name}</b> cheered{' '}
                  {message.to === hall.me?.id ? <b>you</b> : target?.name ?? 'someone'} on
                </li>
              )
            }
            return (
              <li key={message.key} className={`msg ${mine ? 'is-mine' : ''}`}>
                {!mine && <Tangyuan outfit={message.from.outfit as OutfitId} size={34} idle={false} mood={sticker?.mood ?? 'happy'} />}
                <div className="msg__body">
                  <span className="msg__meta">
                    <b>{mine ? 'You' : message.from.name}</b> {founders.has(message.from.id) && <FounderBadge />} · {clock(message.at)}
                  </span>
                  {sticker ? (
                    <span className="msg__sticker">
                      <Tangyuan outfit={message.from.outfit as OutfitId} size={64} idle={false} mood={sticker.mood} />
                      <span>{sticker.label}</span>
                    </span>
                  ) : (
                    <p className={`msg__bubble ${message.kind === 'phrase' ? 'msg__bubble--phrase' : ''}`}>{message.kind === 'phrase' ? phraseText(message.value) : message.value}</p>
                  )}
                </div>
                {!mine && (
                  <span className="msg__actions">
                    <button type="button" className="icon-btn" onClick={() => report(message)} aria-label={`Report this message from ${message.from.name}`} title="Report">
                      <Flag size={15} />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => hall.hide(message.from.id)} aria-label={`Hide ${message.from.name}`} title="Hide">
                      <EyeOff size={15} />
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ol>

        <div className="composer">
          <div className="composer__phrases" role="group" aria-label="Quick phrases">
            {PHRASES.map((phrase) => (
              <button key={phrase.id} type="button" className="chip" disabled={cooldown} onClick={() => hall.say(phrase.id) && cool()}>
                {phrase.text}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={stickers} onClick={() => setStickers(!stickers)}>
              <Smile /> Stickers
            </button>
          </div>
          {stickers && (
            <div className="composer__stickers" role="group" aria-label="Stickers">
              {STICKERS.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  className="quick__sticker"
                  disabled={cooldown}
                  onClick={() => {
                    if (hall.sticker(sticker.id)) {
                      cool()
                      setStickers(false)
                    }
                  }}
                  aria-label={`Send the ${sticker.label} sticker`}
                >
                  <Tangyuan size={44} mood={sticker.mood} idle={false} outfit={game.outfit} />
                  <span>{sticker.label}</span>
                </button>
              ))}
            </div>
          )}

          {canType ? (
            <form className="composer__form" onSubmit={submit}>
              <label className="sr-only" htmlFor="hall-message">
                Write a message
              </label>
              <input
                id="hall-message"
                className="composer__input"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  if (note?.kind === 'error') setNote(null)
                }}
                maxLength={MAX_LENGTH}
                placeholder="Write a message…"
                autoComplete="off"
                aria-describedby="hall-note"
              />
              <span className={`composer__count num ${draft.length > MAX_LENGTH - 20 ? 'is-near' : ''}`} aria-hidden="true">
                {draft.length}/{MAX_LENGTH}
              </span>
              <button type="submit" className="btn" disabled={cooldown || !draft.trim()} aria-label="Send">
                <Send /> Send
              </button>
            </form>
          ) : (
            <p className="composer__signin">
              <button type="button" className="btn btn--sm" onClick={() => go('/signin')}>
                Sign in
              </button>{' '}
              to write messages. Quick phrases and stickers work without an account.
            </p>
          )}

          <div id="hall-note" aria-live="polite">
            {note?.kind === 'error' && <p className="composer__error">{note.text}</p>}
            {note?.kind === 'done' && <p className="composer__done">{note.text}</p>}
            {note?.kind === 'care' && (
              <div className="care" role="status">
                <Heart size={18} />
                <p>
                  {note.text.split('findahelpline.com')[0]}
                  <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
                    findahelpline.com
                  </a>
                  {note.text.split('findahelpline.com')[1]}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <aside className="study__side">
        <section className="sheet study__people" aria-labelledby="here-title">
          <h2 className="title" id="here-title">
            Here now
          </h2>
          <ul className="hall__people">
            {hall.peers.map((peer) => {
              const isMe = peer.id === hall.me?.id
              const isFriend = friendIds.has(peer.id)
              return (
                <li key={peer.id} className={`person ${isMe ? 'is-me' : ''}`}>
                  <Tangyuan outfit={peer.outfit as OutfitId} size={34} idle={false} />
                  <span className="person__name">
                    <span>
                      {isMe ? 'You' : peer.name} {peer.founder === true && <FounderBadge />}
                      {isFriend && <span className="tag tag--xs person__friend">friend</span>}
                    </span>
                  </span>
                  {!isMe && (
                    <span className="person__actions">
                      <button type="button" className="icon-btn" onClick={() => hall.cheer(peer.id) && cool()} aria-label={`Cheer ${peer.name} on`} title="Cheer">
                        <Hand size={16} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => onChallenge(peer.id)} aria-label={`Challenge ${peer.name} to a Speed Round`} title="Challenge">
                        <Swords size={16} />
                      </button>
                      {!isFriend && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => {
                            updateGame((state) => ({
                              ...state,
                              friends: [...(state.friends ?? []), { id: peer.id, name: peer.name, outfit: (peer.outfit as OutfitId) ?? 'none', addedDay: day }],
                            }))
                            play('stamp')
                          }}
                          aria-label={`Add ${peer.name} as a friend`}
                          title="Add friend"
                        >
                          <UserPlus size={16} />
                        </button>
                      )}
                      <button type="button" className="icon-btn" onClick={() => hall.hide(peer.id)} aria-label={`Hide ${peer.name}`} title="Hide">
                        <EyeOff size={16} />
                      </button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="sheet study__rules" aria-labelledby="rules-hall-title">
          <h2 className="title" id="rules-hall-title">
            <ShieldCheck size={18} /> Hall rules
          </h2>
          <ul>
            <li>Be kind. No swearing, insults, slurs or threats.</li>
            <li>No phone numbers, emails, usernames or links.</li>
            <li>No personal questions — age, school, where you live, photos.</li>
            <li>Every message is checked when it’s sent and when it arrives. If something slips through, report it with the flag.</li>
          </ul>
        </section>
      </aside>
    </div>
  )
}
