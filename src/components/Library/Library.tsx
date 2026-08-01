import { useState, type CSSProperties } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, LockKeyhole, Plus, UnlockKeyhole, X } from 'lucide-react'

import { Browse } from '../Browse/Browse.tsx'
import beginnerGuide from '../../content/beginnerGuide.json'
import libraryResources from '../../content/libraryResources.json'
import mastersNote from '../../content/mastersNote.json'
import type { Question } from '../../types.ts'
import './library.css'

type LibraryResource = {
  title: string
  url: string
  description: string
}

type BeginnerGuideBlock =
  | { type: 'p'; text: string }
  | { type: 'callout'; label: string; text: string }

type BeginnerGuideChapter = {
  id: string
  number: number
  title: string
  blocks: BeginnerGuideBlock[]
}

type BeginnerGuide = {
  title: string
  chapters: BeginnerGuideChapter[]
}

const BEGINNER_GUIDE = beginnerGuide as BeginnerGuide

type MastersBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'drill'; label: string; text: string }

type MastersEntry = {
  id: string
  section: string
  rule: string
  blocks: MastersBlock[]
  source: { label: string; url: string }
}

type MastersSection = {
  id: string
  label: string
  short: string
  summary: string
}

type MastersNote = {
  title: string
  subtitle: string
  attribution: string
  sections: MastersSection[]
  entries: MastersEntry[]
}

const MASTERS_NOTE = mastersNote as MastersNote

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
    meta: `${MASTERS_NOTE.entries.length} entries`,
    description:
      'The hard-won rules behind an 800 - how to eliminate answers, catch your own rationalizations, find the author in the noise, and review a section so it actually pays.',
    facts: [
      { value: String(MASTERS_NOTE.entries.length), label: 'ENTRIES' },
      { value: String(MASTERS_NOTE.sections.length), label: 'CHAPTERS' },
    ],
    tone: 'blue',
  },
  {
    key: 'beginner',
    kicker: 'FOUNDATIONS',
    title: "Beginner's guide",
    meta: '9 chapters',
    description:
      'Vocabulary, your untimed dictionary score, and the five-step path to stronger critical thinking - the ground floor for SAT Reading.',
    facts: [
      { value: '9', label: 'CHAPTERS' },
      { value: '-', label: 'READ' },
    ],
    tone: 'indigo',
  },
  {
    key: 'resources',
    kicker: 'REFERENCE',
    title: 'Resources',
    meta: '5 picks',
    description:
      'The official apps, question banks, and outside tools worth bookmarking - curated for serious score gains.',
    facts: [
      { value: '5', label: 'PICKS' },
      { value: 'OFFICIAL', label: 'FOCUS' },
    ],
    tone: 'violet',
  },
  {
    key: 'notebook',
    kicker: 'YOURS',
    title: 'Notebook',
    meta: 'Blank pages',
    description:
      'A blank book for whatever is in your head mid-session - a rule you just noticed, a word to look up, a plan for tomorrow.',
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
            full question vault - kept in one room.
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

function BeginnerGuidePage({ guide }: { guide: BeginnerGuide }) {
  const [chapterIndex, setChapterIndex] = useState(0)
  const chapter = guide.chapters[chapterIndex]
  const hasPrev = chapterIndex > 0
  const hasNext = chapterIndex < guide.chapters.length - 1

  return (
    <div className="library__guide">
      <p className="library__guide-kicker">CHAPTER {chapter.number}</p>
      <h3 className="library__guide-title">{chapter.title}</h3>
      <div className="library__guide-body">
        {chapter.blocks.map((block, index) =>
          block.type === 'callout' ? (
            <aside key={index} className="library__guide-callout">
              <strong>{block.label}</strong>
              <p>{block.text}</p>
            </aside>
          ) : (
            <p key={index}>{block.text}</p>
          ),
        )}
      </div>
      <nav className="library__guide-nav" aria-label="Chapter navigation">
        <button
          className="library__guide-nav-btn"
          type="button"
          disabled={!hasPrev}
          onClick={() => setChapterIndex((index) => index - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </button>
        <ol className="library__guide-toc">
          {guide.chapters.map((entry, index) => (
            <li key={entry.id}>
              <button
                className={index === chapterIndex ? 'is-active' : undefined}
                type="button"
                aria-current={index === chapterIndex ? 'page' : undefined}
                aria-label={`Chapter ${entry.number}: ${entry.title}`}
                onClick={() => setChapterIndex(index)}
              >
                {entry.number}
              </button>
            </li>
          ))}
        </ol>
        <button
          className="library__guide-nav-btn"
          type="button"
          disabled={!hasNext}
          onClick={() => setChapterIndex((index) => index + 1)}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </div>
  )
}

function MastersNotePage({ note }: { note: MastersNote }) {
  const [sectionId, setSectionId] = useState<string>('all')
  const [entryIndex, setEntryIndex] = useState(0)

  const entries =
    sectionId === 'all'
      ? note.entries
      : note.entries.filter((entry) => entry.section === sectionId)
  const index = Math.min(entryIndex, entries.length - 1)
  const entry = entries[index]
  const section = note.sections.find((item) => item.id === entry.section)
  const hasPrev = index > 0
  const hasNext = index < entries.length - 1

  const selectSection = (id: string) => {
    setSectionId(id)
    setEntryIndex(0)
  }

  return (
    <div className="library__masters">
      <nav className="library__masters-tabs" aria-label="Note chapters">
        <button
          className={sectionId === 'all' ? 'is-active' : undefined}
          type="button"
          aria-pressed={sectionId === 'all'}
          onClick={() => selectSection('all')}
        >
          ALL
        </button>
        {note.sections.map((item) => (
          <button
            key={item.id}
            className={sectionId === item.id ? 'is-active' : undefined}
            type="button"
            aria-pressed={sectionId === item.id}
            aria-label={item.label}
            onClick={() => selectSection(item.id)}
          >
            {item.short}
          </button>
        ))}
      </nav>

      <article className="library__masters-entry">
        <p className="library__masters-kicker">
          <span>ENTRY {String(index + 1).padStart(2, '0')} / {String(entries.length).padStart(2, '0')}</span>
          <em>{section?.label}</em>
        </p>
        <h3 className="library__masters-rule">{entry.rule}</h3>
        <div className="library__masters-body">
          {entry.blocks.map((block, blockIndex) => {
            if (block.type === 'list') {
              return (
                <ul key={blockIndex} className="library__masters-list">
                  {block.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )
            }
            if (block.type === 'drill') {
              return (
                <aside key={blockIndex} className="library__masters-drill">
                  <strong>{block.label}</strong>
                  <p>{block.text}</p>
                </aside>
              )
            }
            return <p key={blockIndex}>{block.text}</p>
          })}
        </div>
        <p className="library__masters-source">
          <a href={entry.source.url} target="_blank" rel="noopener noreferrer">
            {entry.source.label}
            <ExternalLink aria-hidden="true" />
          </a>
        </p>
      </article>

      <nav className="library__guide-nav" aria-label="Entry navigation">
        <button
          className="library__guide-nav-btn"
          type="button"
          disabled={!hasPrev}
          onClick={() => setEntryIndex(index - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Previous
        </button>
        <ol className="library__masters-ticks">
          {entries.map((item, itemIndex) => (
            <li key={item.id}>
              <button
                className={itemIndex === index ? 'is-active' : undefined}
                type="button"
                aria-current={itemIndex === index ? 'true' : undefined}
                aria-label={item.rule}
                onClick={() => setEntryIndex(itemIndex)}
              />
            </li>
          ))}
        </ol>
        <button
          className="library__guide-nav-btn"
          type="button"
          disabled={!hasNext}
          onClick={() => setEntryIndex(index + 1)}
        >
          Next
          <ChevronRight aria-hidden="true" />
        </button>
      </nav>
    </div>
  )
}

function ResourcesPage({ resources }: { resources: LibraryResource[] }) {
  return (
    <div className="library__resources">
      <p className="library__resources-kicker">CURATED PICKS</p>
      <ol className="library__resource-list">
        {resources.map((resource, index) => (
          <li key={resource.url} className="library__resource-item">
            <span className="library__resource-index">{index + 1}</span>
            <div>
              <h3>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {resource.title}
                  <ExternalLink aria-hidden="true" />
                </a>
              </h3>
              <p>{resource.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
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
          {book.key === 'masters' && (
            <p className="library__spread-credit">{MASTERS_NOTE.attribution}</p>
          )}
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
          ) : book.key === 'resources' ? (
            <ResourcesPage resources={libraryResources as LibraryResource[]} />
          ) : book.key === 'beginner' ? (
            <BeginnerGuidePage guide={BEGINNER_GUIDE} />
          ) : book.key === 'masters' ? (
            <MastersNotePage note={MASTERS_NOTE} />
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
