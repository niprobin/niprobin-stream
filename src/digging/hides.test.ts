import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeN8n } from '../../test/fakeN8n'
import { createMemoryStore } from '../../test/memoryStore'
import { clearHides, createHides, HIDE_UNDO_WINDOW_MS, hideKey, type HideKind } from './hides'

const item = (title: string) => ({ deezerId: `id-${title}`, title, artist: 'Artist' })

function setup(kind: HideKind = 'track', store = createMemoryStore()) {
  const n8n = installFakeN8n()
  n8n.on(`hide-${kind}`, { json: { status: 'success', message: 'Hidden' } })
  const hides = createHides({ kind, getToken: () => 'tok', store })
  const errors: string[] = []
  hides.onError(message => errors.push(message))
  const isHidden = (title: string) => hides.hidden().has(hideKey(item(title)))
  return { n8n, hides, store, errors, isHidden }
}

// Lets the Hide request and its answer settle
const settle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Hide', () => {
  it('hides at once and sends the Hide only once the undo window has passed', async () => {
    const { n8n, hides, isHidden } = setup()

    hides.hide(item('A'))
    expect(isHidden('A')).toBe(true)

    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS - 1)
    expect(n8n.requests).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)
    expect(n8n.requests).toEqual([
      expect.objectContaining({
        path: 'hide-track',
        headers: expect.objectContaining({ 'X-Auth-Token': 'tok' }),
        body: { track: 'A', artist: 'Artist', deezer_id: 'id-A' },
      }),
    ])
    expect(isHidden('A')).toBe(true)
  })

  it('counts a Hide as sent only once its undo window has passed', async () => {
    const { hides } = setup()
    const isSent = (title: string) => hides.sent().has(hideKey(item(title)))

    hides.hide(item('A'))
    expect(isSent('A')).toBe(false)

    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    expect(isSent('A')).toBe(true)
  })

  it('sends albums to hide-album', async () => {
    const { n8n, hides } = setup('album')

    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)

    expect(n8n.requests).toEqual([
      expect.objectContaining({ path: 'hide-album', body: { album: 'A', artist: 'Artist', deezer_id: 'id-A' } }),
    ])
  })

  it('brings the item back and sends nothing when undone in time', async () => {
    const { n8n, hides, isHidden } = setup()

    const { undo } = hides.hide(item('A'))
    undo()

    expect(isHidden('A')).toBe(false)
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS * 2)
    expect(n8n.requests).toHaveLength(0)
  })

  it('ignores an undo once the Hide was sent', async () => {
    const { hides, isHidden } = setup()

    const { undo } = hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    undo()

    expect(isHidden('A')).toBe(true)
  })

  it('sends one Hide when the same item is hidden twice', async () => {
    const { n8n, hides } = setup()

    hides.hide(item('A'))
    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS * 2)

    expect(n8n.requests).toHaveLength(1)
  })

  it('tells listeners when the hidden items change', async () => {
    const { hides } = setup()
    const listener = vi.fn()
    hides.subscribe(listener)

    const { undo } = hides.hide(item('A'))
    undo()

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['refuses', { status: 400, text: 'oops' }, "Couldn't Hide this track"],
    ['answers with an error', { json: { status: 'error', message: 'nope' } }, 'nope'],
    ['fails with a 5xx', { status: 500, text: 'oops' }, "Couldn't Hide this track: no answer from the server"],
    ['is unreachable', { networkError: true as const }, "Couldn't Hide this track: no answer from the server"],
  ])('brings the item back and reports why when n8n %s', async (_, reply, message) => {
    const { n8n, hides, errors, isHidden, store } = setup()
    n8n.on('hide-track', reply)
    n8n.on('tracks-to-discover', { json: [{ track: 'A', artist: 'Artist', deezer_id: 'id-A' }] })
    hides.catchUp([item('A')])

    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    await settle()

    expect(isHidden('A')).toBe(false)
    expect(errors).toEqual([message])
    // A new session wouldn't hide it either
    expect(createHides({ kind: 'track', getToken: () => 'tok', store }).hidden().size).toBe(0)
  })
})

describe('a Hide n8n did not answer clearly', () => {
  it('counts an empty 200 as sent', async () => {
    const { n8n, hides, errors, isHidden } = setup()
    n8n.on('hide-track', { text: '' })

    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    await settle()

    expect(errors).toEqual([])
    expect(isHidden('A')).toBe(true)
  })

  it('counts an unanswered Hide as sent when the backlog no longer lists the item', async () => {
    const { n8n, hides, errors, isHidden } = setup()
    hides.catchUp([item('A'), item('B')])
    n8n.on('hide-track', { status: 524, text: '<html>A timeout occurred</html>' })
    n8n.on('tracks-to-discover', { json: [{ track: 'B', artist: 'Artist', deezer_id: 'id-B' }] })

    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    await settle()

    expect(errors).toEqual([])
    expect(isHidden('A')).toBe(true)
  })
})

describe('Hidden until the server catches up', () => {
  it('keeps a sent Hide across sessions while the backlog still lists the item', async () => {
    const { hides, store } = setup()

    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    await settle()

    const next = createHides({ kind: 'track', getToken: () => 'tok', store })
    next.catchUp([item('A'), item('B')])
    expect(next.hidden().has(hideKey(item('A')))).toBe(true)
  })

  it('forgets a sent Hide once the backlog stops listing the item', async () => {
    const { hides, store, isHidden } = setup()

    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    await settle()
    hides.catchUp([item('B')])

    expect(isHidden('A')).toBe(false)
    expect(createHides({ kind: 'track', getToken: () => 'tok', store }).hidden().size).toBe(0)
  })

  it('keeps a Hide still in its undo window whatever the backlog lists', () => {
    const { hides, isHidden } = setup()

    hides.hide(item('A'))
    hides.catchUp([])

    expect(isHidden('A')).toBe(true)
  })

  it('keeps tracks and albums apart', async () => {
    const store = createMemoryStore()
    const { hides } = setup('track', store)

    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    await settle()

    expect(createHides({ kind: 'album', getToken: () => 'tok', store }).hidden().size).toBe(0)
  })

  it('treats an unreadable saved list as empty', () => {
    const store = createMemoryStore()
    store.setItem('niprobin-hidden-tracks', '{"items":[{"key":"old"}]}')

    expect(createHides({ kind: 'track', getToken: () => 'tok', store }).hidden().size).toBe(0)
  })
})

describe('Logout', () => {
  it('cancels the Hides still in their undo window, as if undone', async () => {
    const { n8n, hides } = setup()

    hides.hide(item('A'))
    hides.dispose()
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS * 2)

    expect(n8n.requests).toHaveLength(0)
  })

  it('forgets the saved Hides, and a late answer does not bring them back', async () => {
    const { n8n, hides, store } = setup()
    let answer!: () => void
    n8n.on('hide-track', () => new Promise(resolve => (answer = () => resolve({ json: { status: 'success' } }))))

    hides.hide(item('A'))
    await vi.advanceTimersByTimeAsync(HIDE_UNDO_WINDOW_MS)
    hides.dispose()
    clearHides(store)
    answer()
    await settle()

    expect(createHides({ kind: 'track', getToken: () => 'tok', store }).hidden().size).toBe(0)
  })
})
