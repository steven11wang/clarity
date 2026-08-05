import { useRef, type ReactNode } from 'react'

type ExamPassageProps = {
  paragraphs: string[]
  highlights: number[]
  /** When on, dragging across the passage highlights (or clears) those words. */
  annotate: boolean
  onHighlightChange: (indices: number[]) => void
  children?: ReactNode
}

// Highlights are stored as word indices rather than DOM ranges, so they
// survive a re-render, a module switch, and the review page round trip.
export function ExamPassage({
  paragraphs,
  highlights,
  annotate,
  onHighlightChange,
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

  return (
    <div
      className={`exam-passage ${annotate ? 'exam-passage--annotate' : ''}`}
      ref={containerRef}
      onMouseUp={applySelection}
    >
      {children}
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {paragraph.split(/(\s+)/).map((token, tokenIndex) => {
            if (!token.trim()) {
              // Carry the highlight across the space so a run of marked words
              // reads as one band rather than striped boxes.
              const joined =
                highlighted.has(wordIndex - 1) && highlighted.has(wordIndex)
              return (
                <span className={joined ? 'exam-highlight' : undefined} key={tokenIndex}>
                  {token}
                </span>
              )
            }
            const index = wordIndex++
            return (
              <span
                className={highlighted.has(index) ? 'exam-highlight' : undefined}
                data-word={index}
                key={tokenIndex}
              >
                {token}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}
