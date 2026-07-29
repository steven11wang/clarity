import { SAT_DOMAINS, type Difficulty, type SatDomain } from './config.ts'

export const MAX_SCORE_SCREENSHOT_BYTES = 10 * 1024 * 1024
export const SCORE_SCREENSHOT_ACCEPT = 'image/png,image/jpeg,image/webp'

const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export type ParsedScoreResults = Partial<Record<SatDomain, Difficulty>>

export type ScoreParseResult =
  | {
      kind: 'parsed'
      results: ParsedScoreResults
      uncertainDomains?: SatDomain[]
      message?: string
    }
  | {
      kind: 'manual-required'
      results?: ParsedScoreResults
      uncertainDomains?: SatDomain[]
      message: string
    }

// Screenshot reading is deliberately behind this small boundary. A future
// browser OCR or server-side vision implementation can be injected into the
// onboarding component without changing the confirmation experience.
export interface ScoreParser {
  parse(file: File): Promise<ScoreParseResult>
}

export class ScoreParserError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ScoreParserError'
    this.code = code
  }
}

type ScoreParserApiResponse =
  | ScoreParseResult
  | {
      error: {
        code: string
        message: string
      }
    }

export const serverScoreParser: ScoreParser = {
  async parse(file: File): Promise<ScoreParseResult> {
    let response: Response
    try {
      response = await fetch('/api/parse-score', {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      })
    } catch {
      throw new ScoreParserError(
        'Clarity could not reach the secure screenshot-analysis service. Try again, or enter the four results manually.',
        'VISION_UNREACHABLE',
      )
    }

    let payload: ScoreParserApiResponse
    try {
      payload = (await response.json()) as ScoreParserApiResponse
    } catch {
      throw new ScoreParserError(
        'The screenshot-analysis service returned an unreadable response. Try again, or enter the results manually.',
        'VISION_INVALID_RESPONSE',
      )
    }

    if (!response.ok || 'error' in payload) {
      const error =
        'error' in payload
          ? payload.error
          : {
              code: 'VISION_FAILED',
              message:
                'Clarity could not analyze that screenshot. Try again, or enter the four results manually.',
            }
      throw new ScoreParserError(error.message, error.code)
    }

    return payload
  },
}

// This adapter remains useful for tests, offline environments, and an explicit
// manual-entry path. Production onboarding uses serverScoreParser by default.
export const manualScoreParser: ScoreParser = {
  async parse(_file: File): Promise<ScoreParseResult> {
    return {
      kind: 'manual-required',
      results: {},
      uncertainDomains: [...SAT_DOMAINS],
      message:
        'Automatic screenshot reading is not connected yet. Use the report as a reference and choose the result shown for each domain below.',
    }
  },
}

export function validateScoreScreenshot(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return 'Choose a PNG, JPEG, or WebP image.'
  }
  if (file.size <= 0) {
    return 'That image appears to be empty. Choose another screenshot.'
  }
  if (file.size > MAX_SCORE_SCREENSHOT_BYTES) {
    return 'Choose an image that is 10 MB or smaller.'
  }
  return null
}
