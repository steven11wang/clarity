import { useRef, type ReactNode } from 'react'

import { isLookupable, normalizeWord } from '../../dictionary/lookup.ts'
import { sentenceAt } from '../../dictionary/sentence.ts'
import type { LookupAnchor } from '../../dictionary/useWordLookup.ts'

export type PassageLookup = {
  word: string
  sentence: string
  anchor: LookupAnchor
}

type ExamPassageProps = {
  paragraphs: string[]
  highlights: number[]
  /** When on, dragging across the passage highlights (or clears) those words. */
  annotate: boolean
  onHighlightChange: (indices: number[]) => void
  /** When on, clicking a word looks it up in the dictionary. */
  dictionary?: boolean
  onLookup?: (request: PassageLookup) => void
  children?: ReactNode
}

type PassageToken = {
  text: string
  underlined: boolean
}

function parseParagraphTokens(paragraph: string): PassageToken[] {
  const parts = paragraph.split(/(<u>[\s\S]*?<\/u>)/g)
  const tokens: PassageToken[] = []

  for (const part of parts) {
    if (!part) continue
    const isUnderlined = part.startsWith('<u>') && part.endsWith('</u>')
    const content = isUnderlined ? part.slice(3, -4) : part
    const rawTokens = content.split(/(\s+)/)
    for (const rawToken of rawTokens) {
      if (rawToken) {
        tokens.push({ text: rawToken, underlined: isUnderlined })
      }
    }
  }

  return tokens
}

type PassageBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullet-list'; items: string[] }

function parsePassageBlocks(paragraphs: string[]): PassageBlock[] {
  let normalizedParagraphs: string[] = []
  for (const p of paragraphs) {
    if (p.includes('notes:') && (p.includes(' - ') || p.includes('\n- ') || p.includes('\n• '))) {
      const idx = p.indexOf('notes:')
      const header = p.slice(0, idx + 6).trim()
      const rest = p.slice(idx + 6).trim()
      normalizedParagraphs.push(header)
      const parts = rest
        .split(/\s*[-•*]\s+|\n+[-•*]?\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
      for (const part of parts) {
        normalizedParagraphs.push(`• ${part}`)
      }
    } else if (p.includes('\n')) {
      const lines = p.split('\n').map((l) => l.trim()).filter(Boolean)
      normalizedParagraphs.push(...lines)
    } else {
      normalizedParagraphs.push(p)
    }
  }

  const blocks: PassageBlock[] = []
  let currentList: string[] = []

  for (const p of normalizedParagraphs) {
    const isBullet = /^[•\-*]\s*/.test(p)
    if (isBullet) {
      const cleaned = p.replace(/^[•\-*]\s*/, '')
      currentList.push(cleaned)
    } else {
      if (currentList.length > 0) {
        blocks.push({ type: 'bullet-list', items: currentList })
        currentList = []
      }
      blocks.push({ type: 'paragraph', text: p })
    }
  }
  if (currentList.length > 0) {
    blocks.push({ type: 'bullet-list', items: currentList })
  }

  return blocks
}

// Highlights are stored as word indices rather than DOM ranges, so they
// survive a re-render, a module switch, and the review page round trip.
export function ExamPassage({
  paragraphs,
  highlights,
  annotate,
  onHighlightChange,
  dictionary = false,
  onLookup,
  children,
}: ExamPassageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const highlighted = new Set(highlights)
  let wordIndex = 0

  function applySelection() {
    if (!annotate) return
    const container = containerRef.current
    const selection = window.getSelection()
    if (!container || !selection || selection.isCollapsed) return

    const touched: number[] = []
    container.querySelectorAll<HTMLElement>('[data-word]').forEach((span) => {
      if (!selection.containsNode(span, true)) return
      const index = Number(span.dataset.word)
      if (!Number.isNaN(index)) touched.push(index)
    })
    if (touched.length === 0) return

    const clearing = touched.every((index) => highlighted.has(index))
    const next = new Set(highlights)
    touched.forEach((index) => {
      if (clearing) next.delete(index)
      else next.add(index)
    })
    onHighlightChange([...next].sort((a, b) => a - b))
    selection.removeAllRanges()
  }

  function lookUp(token: string, paragraph: string, offset: number, element: HTMLElement) {
    if (!onLookup) return
    const rect = element.getBoundingClientRect()
    onLookup({
      word: normalizeWord(token),
      sentence: sentenceAt(paragraph, offset),
      anchor: {
        x: rect.left + rect.width / 2,
        y: rect.top,
        top: rect.top,
        bottom: rect.bottom,
      },
    })
  }

  const renderTokens = (text: string) => {
    let charOffset = 0
    const cleanParagraph = text.replace(/<\/?u>/g, '')
    const tokens = parseParagraphTokens(text)
    return tokens.map(({ text: token, underlined: isUnderlined }, tokenIndex) => {
      const offset = charOffset
      charOffset += token.length
      if (!token.trim()) {
        const joined = highlighted.has(wordIndex - 1) && highlighted.has(wordIndex)
        const span = (
          <span className={joined ? 'exam-highlight' : undefined} key={tokenIndex}>
            {token}
          </span>
        )
        return isUnderlined ? <u key={tokenIndex}>{span}</u> : span
      }
      const index = wordIndex++
      const marked = highlighted.has(index)

      let element: ReactNode

      if (dictionary && isLookupable(token)) {
        element = (
          <span
            className={`exam-word ${marked ? 'exam-highlight' : ''}`}
            role="button"
            tabIndex={0}
            data-word={index}
            key={tokenIndex}
            onClick={(event) => {
              event.stopPropagation()
              lookUp(token, cleanParagraph, offset, event.currentTarget)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                lookUp(token, cleanParagraph, offset, event.currentTarget)
              }
            }}
          >
            {token}
          </span>
        )
      } else {
        element = (
          <span className={marked ? 'exam-highlight' : undefined} data-word={index} key={tokenIndex}>
            {token}
          </span>
        )
      }

      return isUnderlined ? <u key={tokenIndex}>{element}</u> : element
    })
  }

  const blocks = parsePassageBlocks(paragraphs)

  return (
    <div
      className={[
        'exam-passage',
        annotate ? 'exam-passage--annotate' : '',
        dictionary ? 'exam-passage--dictionary' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      ref={containerRef}
      onMouseUp={applySelection}
    >
      {children}
      {blocks.map((block, blockIndex) => {
        if (block.type === 'paragraph') {
          return <p key={blockIndex}>{renderTokens(block.text)}</p>
        }
        return (
          <ul className="exam-passage__notes" key={blockIndex}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderTokens(item)}</li>
            ))}
          </ul>
        )
      })}
    </div>
  )
}

