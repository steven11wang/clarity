import { useCallback, useEffect, useRef, useState } from 'react'

import { getSettings, isWordSaved, now, removeWord, saveWord } from '../storage/index.ts'
import {
  cachedLookup,
  lookupWord,
  normalizeWord,
  otherSenses,
  pickSense,
  preloadDictionary,
  type LookupResult,
  type WordSense,
} from './lookup.ts'
import { createWordEntry } from './wordBank.ts'

export type LookupAnchor = { x: number; y: number; top: number; bottom: number }

export type WordLookupRequest = {
  word: string
  sentence: string
  anchor: LookupAnchor
  source?: { examId: string; questionId: string } | null
}

export type WordLookupState =
  | { phase: 'idle' }
  | ({ phase: 'loading' } & WordLookupRequest)
  | ({
      phase: 'ready'
      sense: WordSense
      alternates: WordSense[]
      saved: boolean
    } & WordLookupRequest)
  | ({ phase: 'missing' } & WordLookupRequest)
  | ({ phase: 'error'; message: string } & WordLookupRequest)

const IDLE: WordLookupState = { phase: 'idle' }

/**
 * Drives the passage dictionary: one open popup at a time, cache-first so a
 * repeat tap never flashes a spinner, and a save that files the word - with the
 * sentence it was read in - into the word bank.
 */
export function useWordLookup() {
  const [state, setState] = useState<WordLookupState>(IDLE)
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  // Pull the baked dictionary down while the learner is still reading, so the
  // first tap answers from memory instead of showing a spinner.
  useEffect(() => {
    void preloadDictionary()
  }, [])

  const close = useCallback(() => {
    requestId.current += 1
    controller.current?.abort()
    controller.current = null
    setState(IDLE)
  }, [])

  const resolve = useCallback((request: WordLookupRequest, result: LookupResult): WordLookupState => {
    if (result.status === 'missing') return { phase: 'missing', ...request }
    const sense = pickSense(result.senses, request.sentence, request.word)
    if (!sense) return { phase: 'missing', ...request }
    return {
      phase: 'ready',
      ...request,
      sense,
      alternates: otherSenses(result.senses, sense).slice(0, 4),
      saved: isWordSaved(normalizeWord(request.word)),
    }
  }, [])

  const open = useCallback(
    (request: WordLookupRequest, attempt = 0) => {
      requestId.current += 1
      const id = requestId.current
      controller.current?.abort()

      const cached = cachedLookup(request.word)
      if (cached) {
        controller.current = null
        setState(resolve(request, cached))
        return
      }

      const next = new AbortController()
      controller.current = next
      setState({ phase: 'loading', ...request })

      lookupWord(request.word, { signal: next.signal })
        .then((result) => {
          if (requestId.current !== id) return
          setState(resolve(request, result))
        })
        .catch((error: unknown) => {
          if (requestId.current !== id) return
          if (error instanceof DOMException && error.name === 'AbortError') return
          // The live fallback is a free third-party service with no uptime
          // guarantee, and most of its failures are a one-off blip rather than
          // a real outage. One immediate, silent retry clears those before the
          // learner ever sees an error - only a second failure in a row is
          // worth interrupting them for.
          if (attempt === 0) {
            open(request, 1)
            return
          }
          setState({
            phase: 'error',
            ...request,
            message: 'Could not reach the dictionary. Check your connection and try again.',
          })
        })
    },
    [resolve],
  )

  const retry = useCallback(() => {
    if (state.phase === 'idle') return
    open({
      word: state.word,
      sentence: state.sentence,
      anchor: state.anchor,
      source: state.source,
    })
  }, [open, state])

  /** Save the shown word (or un-save it if it is already filed). */
  const toggleSave = useCallback(() => {
    if (state.phase !== 'ready') return
    const id = normalizeWord(state.word)
    if (state.saved) {
      removeWord(id)
      setState({ ...state, saved: false })
      return
    }
    let sentenceToSave = state.sentence
    const wordCount = sentenceToSave.trim().split(/\s+/).filter(Boolean).length
    if (wordCount <= 2 && state.sense.example) {
      sentenceToSave = state.sense.example
    }
    saveWord(
      createWordEntry(
        {
          id,
          word: state.word,
          partOfSpeech: state.sense.partOfSpeech,
          definition: state.sense.definition,
          sentence: sentenceToSave,
          source: state.source ?? null,
        },
        getSettings().demoMode,
        now(),
      ),
    )
    setState({ ...state, saved: true })
  }, [state])

  return { state, open, close, retry, toggleSave }
}
