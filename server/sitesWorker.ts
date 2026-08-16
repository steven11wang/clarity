import { analyzeScoreScreenshot } from './scoreVision.ts'

type WorkerEnvironment = {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }
  OPENAI_API_KEY?: string
  OPENAI_VISION_MODEL?: string
}

const MAX_REQUEST_BYTES = 10 * 1024 * 1024 + 1

/** The static pages own the public URLs; the React app lives under /app.
 *  Keep this table in sync with FRONT_DOOR in vite.config.ts, which performs
 *  the same mapping for the dev server. */
const PAGE_ROUTES: Record<string, string> = {
  '/': '/landing.html',
  '/plans': '/plans.html',
  '/plans/': '/plans.html',
  '/app': '/index.html',
  '/app/': '/index.html',
}

async function parseScore(
  request: Request,
  environment: WorkerEnvironment,
): Promise<Response> {
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.byteLength > MAX_REQUEST_BYTES) {
    return Response.json(
      {
        error: {
          code: 'IMAGE_TOO_LARGE',
          message: 'Choose an image that is 10 MB or smaller.',
        },
      },
      { status: 413 },
    )
  }

  const result = await analyzeScoreScreenshot(
    {
      method: request.method,
      contentType: request.headers.get('content-type')?.split(';')[0] ?? null,
      body,
    },
    {
      apiKey: environment.OPENAI_API_KEY,
      model: environment.OPENAI_VISION_MODEL,
    },
  )

  return Response.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export default {
  async fetch(request: Request, environment: WorkerEnvironment) {
    const url = new URL(request.url)
    if (url.pathname === '/api/parse-score') {
      return parseScore(request, environment)
    }

    const page = PAGE_ROUTES[url.pathname]
    if (page) {
      return environment.ASSETS.fetch(
        new Request(new URL(page, request.url), request),
      )
    }

    const response = await environment.ASSETS.fetch(request)
    if (
      response.status === 404 &&
      request.method === 'GET' &&
      request.headers.get('accept')?.includes('text/html')
    ) {
      return environment.ASSETS.fetch(
        new Request(new URL('/index.html', request.url), request),
      )
    }
    return response
  },
}
