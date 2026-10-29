import { vi } from 'vitest'
import { webhookLog } from '../src/api/webhook'

// A fake n8n backend for module tests. It replaces global fetch, answers each
// webhook path with a canned reply, and records every request so tests can
// assert on what was sent. It also collects the failures webhook.ts logs,
// keeping them out of the test output.

type Reply =
  | { status?: number; json: unknown }
  | { status?: number; text: string }
  | { networkError: true }

// A handler may answer later (return a promise) to test slow or racing replies
type Handler = (request: RecordedRequest) => Reply | Promise<Reply>

export type RecordedRequest = {
  path: string
  method: string
  headers: Record<string, string>
  body: unknown
}

const BASE_URL = 'https://n8n.niprobin.com/webhook/'

export function installFakeN8n() {
  const handlers = new Map<string, Handler>()
  const requests: RecordedRequest[] = []
  const logged: string[] = []
  webhookLog.warn = message => {
    logged.push(message)
  }

  const fakeFetch = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = String(input)
    if (!url.startsWith(BASE_URL)) throw new Error(`Unexpected request to ${url}`)

    const request: RecordedRequest = {
      path: url.slice(BASE_URL.length),
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    requests.push(request)

    const handler = handlers.get(request.path)
    if (!handler) throw new Error(`No fake n8n reply for /${request.path}`)

    // Like the real fetch, an aborted request rejects even if n8n never answers
    const reply = await new Promise<Reply>((resolve, reject) => {
      const abort = () => reject(new DOMException('Aborted', 'AbortError'))
      if (init.signal?.aborted) return abort()
      init.signal?.addEventListener('abort', abort)
      Promise.resolve(handler(request)).then(resolve, reject)
    })
    if ('networkError' in reply) throw new TypeError('Network request failed')

    const status = reply.status ?? 200
    const text = 'json' in reply ? JSON.stringify(reply.json) : reply.text
    return new Response(text, { status, headers: { 'Content-Type': 'application/json' } })
  })

  global.fetch = fakeFetch as unknown as typeof fetch

  return {
    // Answer every request to `path` with `reply` (or a function of the request)
    on(path: string, reply: Reply | Handler) {
      handlers.set(path, typeof reply === 'function' ? reply : () => reply)
    },
    requests,
    logged,
  }
}
