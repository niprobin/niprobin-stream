import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeN8n } from '../../test/fakeN8n'
import { createFollowedArtists, matchesArtist, UNFOLLOW_UNDO_WINDOW_MS } from './followedArtists'

const ROWS = [
  { deezer_id: 27, artist: 'Daft Punk' },
  { deezer_id: '1', artist: 'aphex Twin' },
  { deezer_id: null, artist: 'No id' },
  { deezer_id: '2', artist: 'Björk' },
]

async function setup() {
  const n8n = installFakeN8n()
  n8n.on('followed-artists', { json: ROWS })
  n8n.on('unfollow-artist', { json: { status: 'success' } })
  const followed = createFollowedArtists({ getToken: () => 'tok' })
  const errors: string[] = []
  followed.onError(message => errors.push(message))
  await followed.load()
  const names = () => followed.getState().artists?.map(a => a.name)
  return { n8n, followed, errors, names }
}

const daftPunk = { deezer_id: '27', name: 'Daft Punk' }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Followed artists', () => {
  it('lists the artists A→Z, ignoring case, without the rows that have no deezer_id', async () => {
    const { n8n, names } = await setup()

    expect(names()).toEqual(['aphex Twin', 'Björk', 'Daft Punk'])
    expect(n8n.requests[0].headers).toMatchObject({ 'X-Auth-Token': 'tok' })
  })

  it('says when the list could not load', async () => {
    const n8n = installFakeN8n()
    n8n.on('followed-artists', { status: 500, text: 'oops' })
    const followed = createFollowedArtists({ getToken: () => 'tok' })
    const errors: string[] = []
    followed.onError(message => errors.push(message))

    await followed.load()

    expect(followed.getState()).toMatchObject({ artists: null, loadFailed: true, isLoading: false })
    expect(errors).toEqual(["Couldn't load the Followed artists"])
  })

  it('takes an unfollowed artist out at once and sends the Unfollow once the undo window has passed', async () => {
    const { n8n, followed, names } = await setup()

    followed.unfollow(daftPunk)
    expect(names()).toEqual(['aphex Twin', 'Björk'])

    await vi.advanceTimersByTimeAsync(UNFOLLOW_UNDO_WINDOW_MS - 1)
    expect(n8n.requests.filter(r => r.path === 'unfollow-artist')).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)
    expect(n8n.requests.filter(r => r.path === 'unfollow-artist')).toEqual([
      expect.objectContaining({ body: { artist: 'Daft Punk', deezer_id: '27' } }),
    ])
    expect(names()).toEqual(['aphex Twin', 'Björk'])
  })

  it('brings the artist back on Undo and sends nothing', async () => {
    const { n8n, followed, names } = await setup()

    const { undo } = followed.unfollow(daftPunk)
    undo()
    await vi.advanceTimersByTimeAsync(UNFOLLOW_UNDO_WINDOW_MS)

    expect(names()).toEqual(['aphex Twin', 'Björk', 'Daft Punk'])
    expect(n8n.requests.filter(r => r.path === 'unfollow-artist')).toHaveLength(0)
  })

  it('brings the artist back when n8n refuses the Unfollow', async () => {
    const { n8n, followed, errors, names } = await setup()
    n8n.on('unfollow-artist', { json: { status: 'error', message: 'Nope' } })

    followed.unfollow(daftPunk)
    await vi.advanceTimersByTimeAsync(UNFOLLOW_UNDO_WINDOW_MS)

    expect(names()).toEqual(['aphex Twin', 'Björk', 'Daft Punk'])
    expect(errors).toEqual(['Nope'])
  })

  it('keeps an artist being unfollowed out of a list loaded meanwhile', async () => {
    const { followed, names } = await setup()

    followed.unfollow(daftPunk)
    await followed.load()

    expect(names()).toEqual(['aphex Twin', 'Björk'])
  })

  it('cancels the Unfollows still waiting on logout', async () => {
    const { n8n, followed } = await setup()

    followed.unfollow(daftPunk)
    followed.dispose()
    await vi.advanceTimersByTimeAsync(UNFOLLOW_UNDO_WINDOW_MS)

    expect(n8n.requests.filter(r => r.path === 'unfollow-artist')).toHaveLength(0)
  })
})

describe('The Artists filter', () => {
  it('ignores case and accents', () => {
    expect(matchesArtist('Björk', 'bjork')).toBe(true)
    expect(matchesArtist('Daft Punk', 'PUNK')).toBe(true)
    expect(matchesArtist('Daft Punk', 'aphex')).toBe(false)
    expect(matchesArtist('Daft Punk', '  ')).toBe(true)
  })
})
