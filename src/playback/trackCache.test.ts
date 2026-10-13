import { installFakeN8n, type RecordedRequest } from '../../test/fakeN8n'
import { createMemoryTrackFiles } from '../../test/memoryTrackFiles'
import { createTrackCache } from './trackCache'

const streamUrl = (title: string) => `https://files.example.com/${title}.flac`
const track = (title: string) => ({ deezerId: `id-${title}`, title, artist: 'Artist' })

// Every file is 100 bytes, so a 250-byte cache holds two
function setup({ maxBytes = 250, network = { online: true } }: { maxBytes?: number; network?: { online: boolean } } = {}) {
  const n8n = installFakeN8n()
  n8n.on('stream', (request: RecordedRequest) => {
    const title = (request.body as { track: string }).track
    return { json: { stream_url: streamUrl(title), track: title, artist: 'Artist', hash_url: `hash-${title}` } }
  })
  const files = createMemoryTrackFiles()
  const clock = { now: 0 }
  const cache = createTrackCache({
    files: files.trackFiles,
    getToken: () => 'tok',
    maxBytes,
    now: () => ++clock.now,
    isOnline: () => network.online,
  })
  const play = (...titles: string[]) =>
    titles.reduce<Promise<unknown>>((done, title) => done.then(() => cache.ensure(track(title), 'digging')), Promise.resolve())
  return { cache, files, play, n8n, stored: () => files.storedUrls().map(url => url.split('/').at(-1)) }
}

describe('Track Cache cleanup', () => {
  it('reports its size', async () => {
    const { cache, play } = setup({ maxBytes: 1000 })
    expect(await cache.size()).toBe(0)

    await play('A', 'B', 'C')

    expect(await cache.size()).toBe(300)
  })

  it('deletes the least recently played files once it passes its limit', async () => {
    const { play, stored } = setup()

    await play('A', 'B', 'C')

    expect(stored()).toEqual(['B.flac', 'C.flac'])
  })

  it('counts a replay as a fresh play', async () => {
    const { play, stored } = setup()

    await play('A', 'B', 'A', 'C')

    expect(stored()).toEqual(['A.flac', 'C.flac'])
  })

  it('never deletes protected tracks, even when they are the oldest', async () => {
    const { cache, play, stored } = setup()
    cache.protect([track('A')])

    await play('A', 'B', 'C')

    expect(stored()).toEqual(['A.flac', 'C.flac'])
  })

  it('stays over its limit rather than delete a protected track', async () => {
    const { cache, play, stored } = setup()
    cache.protect([track('A'), track('B'), track('C')])

    await play('A', 'B', 'C')

    expect(stored()).toEqual(['A.flac', 'B.flac', 'C.flac'])
  })

  it('keeps only the protected tracks by default, since files live in memory', async () => {
    const { cache, play, stored } = setup({ maxBytes: undefined })
    cache.protect([track('B'), track('C')])

    await play('A', 'B', 'C')

    expect(stored()).toEqual(['B.flac', 'C.flac'])
  })

  it('clear deletes everything but the tracks to keep', async () => {
    const { cache, play, stored } = setup({ maxBytes: 1000 })
    await play('A', 'B', 'C')

    await cache.clear([track('B')])

    expect(stored()).toEqual(['B.flac'])
    expect(await cache.size()).toBe(100)
  })

  it('downloads a cleared track again the next time it plays', async () => {
    const { cache, play, files } = setup({ maxBytes: 1000 })
    await play('A')
    await cache.clear([])

    await play('A')

    expect(files.downloads).toEqual([streamUrl('A'), streamUrl('A')])
  })
})

describe('stream details', () => {
  it('remembers what /stream said about a track it looked up', async () => {
    const { cache, play } = setup()
    expect(cache.details(track('A'))).toBeUndefined()

    await play('A')

    expect(cache.details(track('A'))).toMatchObject({ title: 'A', hashUrl: 'hash-A' })
  })
})

describe('offline', () => {
  it('plays a track already stored', async () => {
    const network = { online: true }
    const { cache, play } = setup({ maxBytes: 1000, network })
    await play('A')
    network.online = false

    await expect(cache.ensure(track('A'), 'digging')).resolves.toMatchObject({ ok: true })
  })

  it('refuses a track that is not stored without looking it up', async () => {
    const { cache, n8n } = setup({ network: { online: false } })

    await expect(cache.ensure(track('A'), 'digging')).resolves.toEqual({ ok: false, error: "You're offline" })
    expect(n8n.requests).toEqual([])
  })
})
