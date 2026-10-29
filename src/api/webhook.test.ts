// Shared word for word with the PWA, like webhook.ts
import { installFakeN8n } from '../../test/fakeN8n'
import { callAction, read, readList, settleAction } from './webhook'

describe('callAction', () => {
  it('sends the payload as an authenticated POST', async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', { json: { status: 'success' } })

    await expect(callAction('like-track', 'tok', { deezer_id: '1' })).resolves.toEqual({ kind: 'success' })
    expect(n8n.requests[0]).toMatchObject({
      path: 'like-track',
      method: 'POST',
      headers: { 'X-Auth-Token': 'tok' },
      body: { deezer_id: '1' },
    })
  })

  it.each([
    ['an empty 200', { text: '' }],
    ['a 200 without a verdict', { json: { id: 7, album: 'Discovery' } }],
    ['success: true', { json: { success: true } }],
    ['error: false', { json: { error: false } }],
    ['a verdict wrapped in an array', { json: [{ status: 'success' }] }],
  ])('counts %s as a success', async (_, reply) => {
    const n8n = installFakeN8n()
    n8n.on('like-track', reply)
    await expect(callAction('like-track', 'tok', {})).resolves.toEqual({ kind: 'success' })
  })

  it("passes on a refusal's message, and only that", async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', { json: { status: 'error', message: ' Already in playlist ' } })
    await expect(callAction('like-track', 'tok', {})).resolves.toEqual({ kind: 'rejected', message: 'Already in playlist' })

    n8n.on('like-track', { json: { success: false, detail: 'row 12 failed' } })
    await expect(callAction('like-track', 'tok', {})).resolves.toEqual({ kind: 'rejected', message: null })
  })

  it("counts a 4xx as a refusal without showing n8n's own message", async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', { status: 404, json: { code: 404, message: 'The requested webhook is not registered.' } })
    await expect(callAction('like-track', 'tok', {})).resolves.toEqual({ kind: 'rejected', message: null })
  })

  it('counts a 5xx, a proxy page and a dropped connection as unknown, and logs them', async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', { status: 524, text: '<html>A timeout occurred</html>' })
    await expect(callAction('like-track', 'tok', {})).resolves.toEqual({ kind: 'unknown', reason: 'server' })

    n8n.on('like-track', { status: 500, json: { message: 'Error in workflow' } })
    await expect(callAction('like-track', 'tok', {})).resolves.toEqual({ kind: 'unknown', reason: 'server' })

    n8n.on('like-track', { networkError: true })
    await expect(callAction('like-track', 'tok', {})).resolves.toEqual({ kind: 'unknown', reason: 'network' })

    expect(n8n.logged).toHaveLength(3)
    expect(n8n.logged[0]).toContain('/like-track')
    expect(n8n.logged[0]).toContain('524')
  })

  it('gives up on an n8n that never answers', async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', () => new Promise(() => {}))
    await expect(callAction('like-track', 'tok', {}, 20)).resolves.toEqual({ kind: 'unknown', reason: 'timeout' })
  })
})

describe('settleAction', () => {
  const failure = "Couldn't Pick this track"

  it('settles success and refusals without checking', async () => {
    let checked = false
    const check = async () => (checked = true)

    await expect(settleAction({ kind: 'success' }, failure, check)).resolves.toEqual({ ok: true })
    await expect(settleAction({ kind: 'rejected', message: null }, failure, check)).resolves.toEqual({
      ok: false,
      error: failure,
    })
    await expect(settleAction({ kind: 'rejected', message: 'Already there' }, failure, check)).resolves.toEqual({
      ok: false,
      error: 'Already there',
    })
    expect(checked).toBe(false)
  })

  it('counts an unknown outcome as a success when the check finds the change', async () => {
    const outcome = { kind: 'unknown', reason: 'server' } as const
    await expect(settleAction(outcome, failure, async () => true)).resolves.toEqual({ ok: true })
  })

  it("says there was no answer when the check doesn't find the change, can't run, or there is none", async () => {
    const outcome = { kind: 'unknown', reason: 'timeout' } as const
    const noAnswer = { ok: false, error: `${failure}: no answer from the server` }

    await expect(settleAction(outcome, failure, async () => false)).resolves.toEqual(noAnswer)
    await expect(
      settleAction(outcome, failure, async () => {
        throw new Error('offline')
      }),
    ).resolves.toEqual(noAnswer)
    await expect(settleAction(outcome, failure)).resolves.toEqual(noAnswer)
  })
})

describe('read and readList', () => {
  it('reads a list from a bare array, { results } or an empty body', async () => {
    const n8n = installFakeN8n()
    n8n.on('picked-tracks', { json: [{ deezer_id: 1 }] })
    await expect(readList('picked-tracks', 'tok')).resolves.toEqual([{ deezer_id: 1 }])
    expect(n8n.requests[0]).toMatchObject({ method: 'GET', headers: { 'X-Auth-Token': 'tok' } })

    n8n.on('picked-tracks', { json: { results: [{ deezer_id: 2 }] } })
    await expect(readList('picked-tracks', 'tok')).resolves.toEqual([{ deezer_id: 2 }])

    n8n.on('picked-tracks', { text: '' })
    await expect(readList('picked-tracks', 'tok')).resolves.toEqual([])
  })

  it('POSTs a read that has a payload, without a token when there is none', async () => {
    const n8n = installFakeN8n()
    n8n.on('search', { json: [] })
    await readList('search', null, { query: 'aphex' })
    expect(n8n.requests[0]).toMatchObject({ method: 'POST', body: { query: 'aphex' } })
    expect(n8n.requests[0].headers['X-Auth-Token']).toBeUndefined()
  })

  it('fails on a non-2xx, an unreadable body, a dropped connection or no answer', async () => {
    const n8n = installFakeN8n()
    n8n.on('album-info', { status: 502, text: 'Bad gateway' })
    await expect(read('album-info', null, {})).resolves.toEqual({ ok: false, reason: 'server' })

    n8n.on('album-info', { text: '<html>' })
    await expect(read('album-info', null, {})).resolves.toEqual({ ok: false, reason: 'server' })

    n8n.on('album-info', { networkError: true })
    await expect(read('album-info', null, {})).resolves.toEqual({ ok: false, reason: 'network' })

    n8n.on('album-info', () => new Promise(() => {}))
    await expect(read('album-info', null, {}, 20)).resolves.toEqual({ ok: false, reason: 'timeout' })

    n8n.on('album-info', { networkError: true })
    await expect(readList('album-info', null)).resolves.toBeNull()
  })
})
