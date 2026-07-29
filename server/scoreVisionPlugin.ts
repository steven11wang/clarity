import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

import {
  analyzeScoreScreenshot,
  type VisionResponse,
} from './scoreVision.ts'

const MAX_REQUEST_BYTES = 10 * 1024 * 1024 + 1

function sendJson(response: ServerResponse, result: VisionResponse) {
  response.statusCode = result.status
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(result.body))
}

async function readBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.byteLength
    if (size > MAX_REQUEST_BYTES) {
      request.destroy()
      throw new Error('request-too-large')
    }
    chunks.push(buffer)
  }

  return Buffer.concat(chunks)
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
) {
  let body: Uint8Array
  try {
    body = await readBody(request)
  } catch {
    sendJson(response, {
      status: 413,
      body: {
        error: {
          code: 'IMAGE_TOO_LARGE',
          message: 'Choose an image that is 10 MB or smaller.',
        },
      },
    })
    return
  }

  const result = await analyzeScoreScreenshot(
    {
      method: request.method ?? 'GET',
      contentType: request.headers['content-type']?.split(';')[0] ?? null,
      body,
    },
    {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_VISION_MODEL,
    },
  )
  sendJson(response, result)
}

export function scoreVisionPlugin(): Plugin {
  return {
    name: 'clarity-score-vision',
    configureServer(server) {
      server.middlewares.use('/api/parse-score', (request, response) => {
        void handleRequest(request, response)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/parse-score', (request, response) => {
        void handleRequest(request, response)
      })
    },
  }
}
