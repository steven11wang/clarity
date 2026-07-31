import { useState, type CSSProperties } from 'react'
import { ArrowLeft, LockKeyhole, Plus, UnlockKeyhole, X } from 'lucide-react'

import { Browse } from '../Browse/Browse.tsx'
import type { Question } from '../../types.ts'
import './library.css'

type LibraryProps = {
  questions: Question[]
  dueCount: number
  timedMode: boolean
  timeLimitSec: number
  onToggleTimed: () => void
  onChangeLimit: (sec: number) => void
  onStart: (questions: Question[]) => void
  onOpenDashboard: () => void
}

type LibraryScreen = 'landing' | 'shelf' | 'question-bank'

type LibraryBook = {
  key: 'masters' | 'beginner' | 'resources' | 'notebook'
  kicker: string
  title: string
  meta: string
  description: string
  facts: Array<{ value: string; label: string }>
  tone: string
}

const BOOKS: LibraryBook[] = [
  {
    key: 'masters',
    kicker: 'ADVANCED',
    title: "Master's note",
    meta: '18 entries',
    description:
      'The hard-won rules you wrote yourself after each miss — trap answers, tone shifts, and the patterns that keep coming back.',
    facts: [
      { value: '18', label: 'ENTRIES' },
      { value: '—', label: 'LAST EDIT' },
    ],
    tone: 'blue',
  },
  {
    key: 'beginner',
    kicker: 'FOUNDATIONS',
    title: "Beginner's guide",
    meta: '9 chapters',
    description:
      'Question types, timing, and how the section is built — the ground floor, written plainly and read in one sitting.',
    facts: [
      { value: '9', label: 'CHAPTERS' },
      { value: '—', label: 'READ' },
    ],
    tone: 'indigo',
  },
  {
    key: 'resources',
    kicker: 'REFERENCE',
    title: 'Resources',
    meta: '32 saved',
    description:
      'Passages, vocabulary sets, and outside reading you flagged for later — everything you saved, in one place.',
    facts: [
      { value: '32', label: 'SAVED' },
      { value: '6', label: 'FOLDERS' },
    ],
    tone: 'violet',
  },
  {
    key: 'notebook',
    kicker: 'YOURS',
    title: 'Notebook',
    meta: 'Blank pages',
    description:
      'A blank book for whatever is in your head mid-session — a rule you just noticed, a word to look up, a plan for tomorrow.',
    facts: [
      { value: '0', label: 'PAGES' },
      { value: 'NEW', label: 'STATUS' },
    ],
    tone: 'green',
  },
]

export function Library(props: LibraryProps) {
  const [screen, setScreen] = useState<LibraryScreen>('landing')
  const [vaultOpen, setVaultOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<LibraryBook>(BOOKS[0])
  const [openBook, setOpenBook] = useState<LibraryBook | null>(null)
  const [note, setNote] = useState('')

  if (screen === 'question-bank') {
    return (
      <section className="library library--question-bank" aria-label="Question Bank">
        <button
          className="library__back"
          type="button"
          onClick={() => setScreen('shelf')}
        >
          <ArrowLeft aria-hidden="true" />
          Back to library
        </button>
        <Browse {...props} embedded />
      </section>
    )
  }

  if (screen === 'landing') {
    return (
      <section className="library library--landing" aria-label="Library">
        <div className="library__landing-copy">
          <p className="library__eyebrow">SAT READING &amp; WRITING</p>
          <h1>The library<br />is open.</h1>
          <p className="library__lede">
            Every note you’ve written, every guide you’ve unlocked, and the
            full question vault — kept in one room.
          </p>
          <button
            className="console-button console-button--primary library__enter"
            type="button"
            onClick={() => setScreen('shelf')}
          >
            ENTER LIBRARY
          </button>
          <dl className="library__stats">
            <div><dt>3</dt><dd>VOLUMES</dd></div>
            <div><dt>{props.questions.length}</dt><dd>QUESTIONS VAULTED</dd></div>
            <div><dt>0</dt><dd>NOTES WRITTEN</dd></div>
          </dl>
        </div>
        <div className="library__landing-art" aria-hidden="true">
          <div className="library__landing-glow" />
          <div className="library__standing-book"><span /></div>
        </div>
      </section>
    )
  }

  return (
    <section className="library library--shelf" aria-label="Your library">
      <header className="library__shelf-head">
        <div>
          <button className="library__back" type="button" onClick={() => setScreen('landing')}>
            <ArrowLeft aria-hidden="true" />
            Back
          </button>
          <h1>Your library</h1>
        </div>
        <p>Pull a volume off the shelf, or open the vault for a fresh set of questions.</p>
      </header>

      <div className="library__shelf-layout">
        <section className="library__bookshelf" aria-label="Library volumes">
          <div className="library__book-row">
            {BOOKS.map((book, index) => (
              <button
                key={book.key}
                className={`library__book library__book--${book.tone} ${selectedBook.key === book.key ? 'is-selected' : ''}`}
                type="button"
                onClick={() => {
                  if (selectedBook.key === book.key) setOpenBook(book)
                  else setSelectedBook(book)
                }}
                aria-label={`${book.title}. ${selectedBook.key === book.key ? 'Open book' : book.meta}`}
                style={{ '--library-book-order': index } as CSSProperties}
              >
                <span className="library__book-spine" />
                <span className="library__book-cover">
                  <span>{book.kicker}</span>
                  <strong>{book.title}</strong>
                  <i />
                  <small>{selectedBook.key === book.key ? 'Click to open' : book.meta}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="library__shelf-edge" />
        </section>

        <aside className="library__vault">
          <p className="library__eyebrow">THE VAULT</p>
          <div className={`library__vault-dial ${vaultOpen ? 'is-open' : ''}`}>
            <span aria-hidden="true" />
            {vaultOpen ? <UnlockKeyhole aria-label="Open" /> : <LockKeyhole aria-label="Locked" />}
            <strong>{vaultOpen ? 'OPEN' : 'LOCKED'}</strong>
          </div>
          <div className="library__vault-count">
            <strong>{props.questions.length}</strong>
            <span>questions inside</span>
          </div>
          <h2>Question bank</h2>
          <p>
            {vaultOpen
              ? 'Unlocked. Mixed difficulty, drawn from every domain you have practiced.'
              : 'Sealed until you turn the dial. Inside: every question you have not yet answered correctly.'}
          </p>
          <button
            className={`console-button ${vaultOpen ? 'console-button--primary' : 'library__unlock'}`}
            type="button"
            onClick={() => vaultOpen ? setScreen('question-bank') : setVaultOpen(true)}
          >
            {vaultOpen ? 'START A SET' : 'TURN THE DIAL'}
          </button>
        </aside>
      </div>

      <article className="library__selection-detail">
        <p className="library__eyebrow">{selectedBook.kicker}</p>
        <h2>{selectedBook.title}</h2>
        <p>{selectedBook.description}</p>
      </article>

      {openBook && (
        <BookOverlay
          book={openBook}
          note={note}
          onChangeNote={setNote}
          onClose={() => setOpenBook(null)}
        />
      )}
    </section>
  )
}

function BookOverlay({
  book,
  note,
  onChangeNote,
  onClose,
}: {
  book: LibraryBook
  note: string
  onChangeNote: (value: string) => void
  onClose: () => void
}) {
  return (
    <div className="library__overlay" role="dialog" aria-modal="true" aria-label={book.title}>
      <article className="library__spread">
        <div className="library__spread-intro">
          <p className="library__eyebrow">{book.kicker}</p>
          <h2>{book.title}</h2>
          <p>{book.description}</p>
          <dl>
            {book.facts.map((fact) => <div key={fact.label}><dt>{fact.value}</dt><dd>{fact.label}</dd></div>)}
          </dl>
        </div>
        <div className="library__spread-page">
          <button className="library__close" type="button" onClick={onClose}>
            <X aria-hidden="true" />
            Close book
          </button>
          {book.key === 'notebook' ? (
            <label className="library__notebook">
              <span>PAGE 1</span>
              <textarea value={note} onChange={(event) => onChangeNote(event.target.value)} placeholder="Jot it down…" />
              <small>Saved for this visit</small>
            </label>
          ) : (
            <div className="library__coming-soon">
              <Plus aria-hidden="true" />
              <h3>Pages coming soon</h3>
              <p>Contents for this volume haven’t been added yet.</p>
            </div>
          )}
        </div>
      </article>
    </div>
  )
}
