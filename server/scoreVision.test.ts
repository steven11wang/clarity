import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  analyzeScoreScreenshot,
  buildOpenAIRequest,
  toScoreParseResult,
} from './scoreVision.ts'

const domains = {
  'Information and Ideas': { difficulty: 'Easy' as const, confidence: 0.98 },
  'Craft and Structure': { difficulty: 'Medium' as const, confidence: 0.93 },
  'Expression of Ideas': { difficulty: 'Hard' as const, confidence: 0.88 },
  'Standard English Conventions': {
    difficulty: 'Medium' as const,
    confidence: 0.76,
  },
}

describe('server score vision', () => {
  it('builds a private structured vision request', () => {
    const request = buildOpenAIRequest(
      new Uint8Array([1, 2, 3]),
      'image/png',
      'gpt-test',
    )

    assert.equal(request.model, 'gpt-test')
    assert.equal(request.store, false)
    assert.deepEqual(request.reasoning, { effort: 'none' })
    assert.equal(
      (
        request.input as Array<{
          content: Array<{ image_url?: string; detail?: string }>
        }>
      )[0].content[1].image_url,
      'data:image/png;base64,AQID',
    )
    assert.equal(
      (
        request.input as Array<{
          content: Array<{ image_url?: string; detail?: string }>
        }>
      )[0].content[1].detail,
      'high',
    )
  })

  it('keeps low-confidence and unknown domains on the correction path', () => {
    const result = toScoreParseResult({
      reportRecognized: true,
      domains: {
        ...domains,
        'Expression of Ideas': {
          difficulty: 'Unknown',
          confidence: 0.2,
        },
      },
      message: 'Three results were readable.',
    })

    assert.equal(result.kind, 'parsed')
    assert.deepEqual(result.results, {
      'Information and Ideas': 'Easy',
      'Craft and Structure': 'Medium',
      'Standard English Conventions': 'Medium',
    })
    assert.deepEqual(result.uncertainDomains, [
      'Expression of Ideas',
      'Standard English Conventions',
    ])
  })

  it('does not call the provider when the server key is missing', async () => {
    let called = false
    const result = await analyzeScoreScreenshot(
      {
        method: 'POST',
        contentType: 'image/png',
        body: new Uint8Array([1]),
      },
      {},
      async () => {
        called = true
        return new Response()
      },
    )

    assert.equal(called, false)
    assert.equal(result.status, 503)
    assert.deepEqual(result.body, {
      error: {
        code: 'VISION_NOT_CONFIGURED',
        message:
          'Automatic screenshot reading is not configured on this server yet. Add the server API key, or enter the four results manually.',
      },
    })
  })

  it('returns parsed results from a successful structured provider response', async () => {
    let authorization = ''
    const result = await analyzeScoreScreenshot(
      {
        method: 'POST',
        contentType: 'image/jpeg',
        body: new Uint8Array([4, 5, 6]),
      },
      {
        apiKey: 'server-secret',
        model: 'gpt-test',
      },
      async (_url, init) => {
        authorization = new Headers(init?.headers).get('Authorization') ?? ''
        return Response.json({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    reportRecognized: true,
                    domains,
                    message: 'Check the highlighted result.',
                  }),
                },
              ],
            },
          ],
        })
      },
    )

    assert.equal(authorization, 'Bearer server-secret')
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, {
      kind: 'parsed',
      results: {
        'Information and Ideas': 'Easy',
        'Craft and Structure': 'Medium',
        'Expression of Ideas': 'Hard',
        'Standard English Conventions': 'Medium',
      },
      uncertainDomains: ['Standard English Conventions'],
      message: 'Check the highlighted result.',
    })
  })

  it('validates method, media type, and size before provider use', async () => {
    const fetchImpl = async () => {
      throw new Error('provider should not be called')
    }
    const method = await analyzeScoreScreenshot(
      { method: 'GET', contentType: 'image/png', body: new Uint8Array([1]) },
      { apiKey: 'test' },
      fetchImpl,
    )
    const type = await analyzeScoreScreenshot(
      { method: 'POST', contentType: 'application/pdf', body: new Uint8Array([1]) },
      { apiKey: 'test' },
      fetchImpl,
    )
    const empty = await analyzeScoreScreenshot(
      { method: 'POST', contentType: 'image/png', body: new Uint8Array() },
      { apiKey: 'test' },
      fetchImpl,
    )

    assert.equal(method.status, 405)
    assert.equal(type.status, 415)
    assert.equal(empty.status, 400)
  })
})
