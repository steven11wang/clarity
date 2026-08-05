import { useEffect, useState } from 'react'

import { examAssetPath, type ExamFigure as Figure } from './examData.ts'

// SVG figures ship with `var(--graph-*)` colours in their attributes. An <img>
// renders in its own document, where those variables do not exist, so the
// chart comes out blank. Inlining the markup lets the exam theme colour it.
export function ExamFigure({ figure }: { figure: Figure }) {
  const isSvg = figure.src.endsWith('.svg')
  const [markup, setMarkup] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isSvg) return
    let live = true
    fetch(examAssetPath(figure.src))
      .then((response) => {
        if (!response.ok) throw new Error('figure missing')
        return response.text()
      })
      .then((text) => {
        if (live) setMarkup(text)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [figure.src, isSvg])

  if (!isSvg) {
    return (
      <figure className="exam-figure">
        <img src={examAssetPath(figure.src)} alt={figure.alt} />
      </figure>
    )
  }

  if (failed) {
    return (
      <figure className="exam-figure exam-figure--missing">
        <p>{figure.alt}</p>
      </figure>
    )
  }

  return (
    <figure
      className="exam-figure"
      role="img"
      aria-label={figure.alt}
      dangerouslySetInnerHTML={markup ? { __html: markup } : undefined}
    />
  )
}
