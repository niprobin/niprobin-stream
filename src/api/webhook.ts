// Every call to the n8n webhooks, shared word for word by both nipstream apps
// (copied as PWA ADR 0001 describes: change one copy, carry it to the other).
// Only fetch is used, so it runs in React Native and the browser alike. The
// reply format n8n should follow is in docs/n8n-contract.md (native repo).

export const BASE_URL = 'https://n8n.niprobin.com/webhook'

// How long an action (Pick, Hide, Rate…) waits for n8n before giving up
export const ACTION_TIMEOUT_MS = 30_000

// How long a read (lists, search, album and artist pages) waits for n8n
export const READ_TIMEOUT_MS = 30_000

export function authHeaders(token: string | null): Record<string, string> {
  return token
    ? { 'Content-Type': 'application/json', 'X-Auth-Token': token }
    : { 'Content-Type': 'application/json' }
}

// Why a call came back without a usable answer: no answer in time, no
// connection, or a reply the app can't use (5xx, a proxy's HTML page)
export type FailureReason = 'timeout' | 'network' | 'server'

// Where failures are written, so the next one can be traced. Tests swap it.
export const webhookLog = {
  warn(message: string) {
    console.warn(message)
  },
}

function logFailure(path: string, detail: string) {
  webhookLog.warn(`[n8n] /${path} failed: ${detail}`)
}

type Reply = { ok: true; status: number; httpOk: boolean; text: string } | { ok: false; reason: FailureReason }

type RequestOptions = {
  token?: string | null
  // A POST body; GET when left out
  payload?: unknown
  timeoutMs: number
}

// One request, never throwing: the reply's status and text, or why there's none
async function request(path: string, { token = null, payload, timeoutMs }: RequestOptions): Promise<Reply> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      signal: controller.signal,
      headers: authHeaders(token),
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    })
    const text = await response.text()
    return { ok: true, status: response.status, httpOk: response.ok, text }
  } catch (error) {
    const reason = controller.signal.aborted ? 'timeout' : 'network'
    logFailure(path, reason === 'timeout' ? `no answer after ${timeoutMs} ms` : String(error))
    return { ok: false, reason }
  } finally {
    clearTimeout(timer)
  }
}

function parseJson(text: string): unknown {
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// n8n wraps a single reply in an array when the workflow ends on a list of items
function unwrap(data: unknown): Record<string, unknown> | null {
  const item = Array.isArray(data) && data.length === 1 ? data[0] : data
  return item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : null
}

// What became of an action. Unknown means it may or may not have gone
// through: the caller checks the list it changes before saying either way.
export type ActionOutcome =
  | { kind: 'success' }
  | { kind: 'rejected'; message: string | null }
  | { kind: 'unknown'; reason: FailureReason }

// What the server says in the body, when it says anything
function verdict(body: Record<string, unknown> | null): 'success' | 'rejected' | null {
  if (!body) return null
  if (typeof body.status === 'string') {
    const status = body.status.toLowerCase()
    if (status === 'success' || status === 'ok') return 'success'
    if (status === 'error' || status === 'failed' || status === 'fail') return 'rejected'
  }
  if (typeof body.success === 'boolean') return body.success ? 'success' : 'rejected'
  if (typeof body.error === 'boolean') return body.error ? 'rejected' : 'success'
  return null
}

// Replies that say nothing about the action itself: the request may have
// been carried out (a gateway timeout, a workflow that failed after the write)
function isUnclearStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 429
}

// POSTs an action. The body's verdict wins; without one, a 2xx is a success,
// a 4xx a refusal and anything else unknown. Only a refusal's `message` is
// ever meant to be shown.
export async function callAction(
  path: string,
  token: string | null,
  payload: unknown,
  timeoutMs = ACTION_TIMEOUT_MS,
): Promise<ActionOutcome> {
  const reply = await request(path, { token, payload, timeoutMs })
  if (!reply.ok) return { kind: 'unknown', reason: reply.reason }

  const body = unwrap(parseJson(reply.text))
  const said = verdict(body)
  if (said === 'success') return { kind: 'success' }

  if (said === 'rejected' || (said === null && !reply.httpOk && !isUnclearStatus(reply.status))) {
    const message = typeof body?.message === 'string' && body.message.trim() ? body.message.trim() : null
    logFailure(path, `refused (HTTP ${reply.status}) ${reply.text.slice(0, 200)}`)
    return { kind: 'rejected', message: said === 'rejected' ? message : null }
  }
  if (said === null && reply.httpOk) return { kind: 'success' }

  logFailure(path, `HTTP ${reply.status} ${reply.text.slice(0, 200)}`)
  return { kind: 'unknown', reason: 'server' }
}

// What the listener is finally told about an action
export type ActionResult = { ok: true } | { ok: false; error: string }

// Settles an action's outcome. An unknown one is checked against the list
// the action changes (`check` answers whether the change is there) and counts
// as a success when it is. `failure` is the app's own message for a refusal.
export async function settleAction(
  outcome: ActionOutcome,
  failure: string,
  check?: () => Promise<boolean>,
): Promise<ActionResult> {
  if (outcome.kind === 'success') return { ok: true }
  if (outcome.kind === 'rejected') return { ok: false, error: outcome.message ?? failure }

  let wentThrough = false
  try {
    wentThrough = check ? await check() : false
  } catch {
    // A check that fails can't confirm anything
  }
  return wentThrough ? { ok: true } : { ok: false, error: `${failure}: no answer from the server` }
}

export type ReadResult = { ok: true; data: unknown } | { ok: false; reason: FailureReason }

// A read: GET without a payload, POST with one. A non-2xx reply or an
// unreadable body is a failure; an empty body reads as null.
export async function read(
  path: string,
  token: string | null,
  payload?: unknown,
  timeoutMs = READ_TIMEOUT_MS,
): Promise<ReadResult> {
  const reply = await request(path, { token, payload, timeoutMs })
  if (!reply.ok) return reply
  if (!reply.httpOk) {
    logFailure(path, `HTTP ${reply.status} ${reply.text.slice(0, 200)}`)
    return { ok: false, reason: 'server' }
  }
  const data = parseJson(reply.text)
  if (data === undefined) {
    logFailure(path, `unreadable reply ${reply.text.slice(0, 200)}`)
    return { ok: false, reason: 'server' }
  }
  return { ok: true, data }
}

// A list endpoint, which answers with a bare array, { results: [...] } or an
// empty body. Null on any failure.
export async function readList(path: string, token: string | null, payload?: unknown): Promise<unknown[] | null> {
  const result = await read(path, token, payload)
  if (!result.ok) return null
  const data = result.data as { results?: unknown } | null
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.results)) return data.results
  return []
}

// A file the server sends back (a track download). Null on any failure.
export async function readFile(path: string, token: string | null, payload: unknown): Promise<Blob | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS * 4)
  try {
    const response = await fetch(`${BASE_URL}/${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    })
    if (response.ok) return await response.blob()
    logFailure(path, `HTTP ${response.status}`)
    return null
  } catch (error) {
    logFailure(path, controller.signal.aborted ? 'no answer in time' : String(error))
    return null
  } finally {
    clearTimeout(timer)
  }
}

// The raw reply, for the call that needs the HTTP status (login)
export async function send(
  path: string,
  token: string | null,
  payload: unknown,
  timeoutMs = READ_TIMEOUT_MS,
): Promise<{ ok: true; status: number; httpOk: boolean; text: string } | { ok: false; reason: FailureReason }> {
  return request(path, { token, payload, timeoutMs })
}
