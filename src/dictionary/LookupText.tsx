import type { ReactNode } from 'react'

import { isLookupable, normalizeWord } from './lookup.ts'
import { sentenceAt } from './sentence.ts'
import type { LookupAnchor } from './useWordLookup.ts'

export type TextLookupRequest = {
  word: string
  sentence: string
  anchor: LookupAnchor
}

type LookupTextProps = {
  text: string
  dictionary?: boolean
  onLookup?: (request: TextLookupRequest) => void
  className?: string
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4'
}

type Token = {
  text: string
  underlined: boolean
}

function parseTokens(text: string): Token[] {
  if (!text) return []
  const parts = text.split(/(<u>[\s\S]*?<\/u>)/g)
  const tokens: Token[] = []

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

export function LookupText({
  text,
  dictionary = false,
  onLookup,
  className,
  as: Component = 'span',
}: LookupTextProps) {
  if (!text) return null

  if (!dictionary || !onLookup) {
    const tokens = parseTokens(text)
    const content: ReactNode[] = tokens.map(({ text: token, underlined }, index) =>
      underlined ? <u key={index}>{token}</u> : <span key={index}>{token}</span>,
    )
    return <Component className={className}>{content}</Component>
  }

  const cleanText = text.replace(/<\/?u>/g, '')
  const tokens = parseTokens(text)
  let charOffset = 0

  const content: ReactNode[] = tokens.map(({ text: token, underlined }, index) => {
    const offset = charOffset
    charOffset += token.length

    if (!token.trim()) {
      return underlined ? <u key={index}>{token}</u> : token
    }

    if (isLookupable(token)) {
      const handleTrigger = (target: HTMLElement) => {
        const rect = target.getBoundingClientRect()
        onLookup({
          word: normalizeWord(token),
          sentence: sentenceAt(cleanText, offset),
          anchor: {
            x: rect.left + rect.width / 2,
            y: rect.top,
            top: rect.top,
            bottom: rect.bottom,
          },
        })
      }

      const wordSpan = (
        <span
          key={index}
          role="button"
          tabIndex={0}
          className="exam-word"
          onClick={(event) => {
            event.stopPropagation()
            handleTrigger(event.currentTarget)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              handleTrigger(event.currentTarget)
            }
          }}
        >
          {token}
        </span>
      )
      return underlined ? <u key={index}>{wordSpan}</u> : wordSpan
    }

    return underlined ? <u key={index}>{token}</u> : token
  })

  return <Component className={className}>{content}</Component>
}
