import { installFakeN8n, type RecordedRequest } from '../../test/fakeN8n'
import { createFakePlayer } from '../../test/fakePlayer'
import { createMemoryTrackFiles } from '../../test/memoryTrackFiles'
import { createPlaybackEngine, type QueueTrack } from './engine'
import { createTrackCache } from './trackCache'

function track(title: string): QueueTrack {
  return { deezerId: `id-${title}`, title, artist: 'Artist', coverUrl: `https://covers.example.com/${title}.jpg` }
}

const LIST = ['One', 'Two', 'Three'].map(track)

// The context that fetches nothing ahead, for tests about the tapped track
// alone; fetching ahead has its own tests at the end
const NO_LOOKAHEAD = 'search'

const streamUrl = (title: string) => `https://files.example.com/${title}.flac`

// Lets every pending promise settle
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

// Lets a chain of lookups and downloads run to its end
async function idle() {
  for (let i = 0; i < 30; i++) await settle()
}

function setup({ maxBytes }: { maxBytes?: number } = {}) {
  const n8n = installFakeN8n()
  // Replies straight away unless a test holds the lookup for a title back
  const heldBack = new Map<string, () => void>()
  const holding = new Set<string>()
  // How many /stream lookups n8n is answering at once, and the most it ever was
  let activeLookups = 0
  let mostActiveLookups = 0
  n8n.on('stream', async (request: RecordedRequest) => {
    const title = (request.body as { track: string }).track
    activeLookups++
    mostActiveLookups = Math.max(mostActiveLookups, activeLookups)
    try {
      if (holding.has(title)) {
        await new Promise<void>(resolve => heldBack.set(title, resolve))
      }
      // Answer on a later tick so overlapping lookups would show
      await settle()
      return { json: { stream_url: streamUrl(title) } }
    } finally {
      activeLookups--
    }
  })

  const files = createMemoryTrackFiles()
  const fakePlayer = createFakePlayer()
  const cache = createTrackCache({ files: files.trackFiles, getToken: () => 'tok', maxBytes })
  const engine = createPlaybackEngine({ cache, player: fakePlayer.player })
  const errors: string[] = []
  engine.onError(message => errors.push(message))

  return {
    n8n,
    files,
    fakePlayer,
    engine,
    errors,
    mostActiveLookups: () => mostActiveLookups,
    lookups: () => n8n.requests.filter(r => r.path === 'stream').map(r => (r.body as { track: string }).track),
    // The /stream lookup for `title` waits until `release` is called
    holdLookup(title: string) {
      holding.add(title)
      return {
        async release() {
          for (let i = 0; !heldBack.has(title); i++) {
            if (i > 100) throw new Error(`No /stream lookup for ${title} to release`)
            await settle()
          }
          heldBack.get(title)!()
          await settle()
        },
      }
    },
  }
}

describe('playing a track from a list', () => {
  it('looks the track up, downloads it into the Track Cache, then plays the local copy', async () => {
    const { engine, fakePlayer, files, lookups, n8n } = setup()

    await engine.playList(LIST, 1, NO_LOOKAHEAD)

    expect(lookups()).toEqual(['Two'])
    expect(n8n.requests[0].body).toMatchObject({ deezer_id: 'id-Two', context: NO_LOOKAHEAD })
    expect(files.downloads).toEqual([streamUrl('Two')])
    expect(fakePlayer.played).toHaveLength(1)
    expect(fakePlayer.played[0]).toMatchObject({
      title: 'Two',
      artist: 'Artist',
      artworkUrl: 'https://covers.example.com/Two.jpg',
    })
    expect(fakePlayer.played[0].uri).toMatch(/^file:\/\//)
    expect(engine.getState()).toMatchObject({ nowPlaying: LIST[1], loadingTrack: null, index: 1 })
  })

  it('shows the tapped track as loading until it starts', async () => {
    const { engine, holdLookup } = setup()
    const lookup = holdLookup('Two')

    const playing = engine.playList(LIST, 1, 'digging')
    await settle()
    expect(engine.getState()).toMatchObject({ loadingTrack: LIST[1], nowPlaying: null })

    await lookup.release()
    await playing
    expect(engine.getState()).toMatchObject({ loadingTrack: null, nowPlaying: LIST[1] })
  })

  it('fetches nothing ahead of a track played from Search', async () => {
    const { engine, lookups, files } = setup()

    await engine.playList(LIST, 0, 'search')
    await idle()

    expect(lookups()).toEqual(['One'])
    expect(files.downloads).toHaveLength(1)
  })

  it('replays a track already in the Track Cache without looking it up again', async () => {
    const { engine, lookups, fakePlayer } = setup()

    await engine.playList(LIST, 0, NO_LOOKAHEAD)
    await engine.next()
    await engine.previous()

    expect(fakePlayer.playedTitles()).toEqual(['One', 'Two', 'One'])
    expect(lookups()).toEqual(['One', 'Two'])
  })

  it('reports a failed lookup and plays nothing', async () => {
    const { engine, n8n, fakePlayer, errors } = setup()
    n8n.on('stream', { status: 500, text: 'boom' })

    await engine.playList(LIST, 0, 'digging')

    expect(errors).toEqual(["Couldn't find this track"])
    expect(fakePlayer.played).toEqual([])
    expect(engine.getState().loadingTrack).toBeNull()
  })

  it('reports a failed download and plays nothing', async () => {
    const { engine, files, fakePlayer, errors } = setup()
    files.failDownloadsFrom(streamUrl('One'))

    await engine.playList(LIST, 0, 'digging')

    expect(errors).toEqual(["Couldn't fetch this track"])
    expect(fakePlayer.played).toEqual([])
  })

  it('retries a track whose download failed the next time it is played', async () => {
    const { engine, files, fakePlayer } = setup()
    files.failDownloadsFrom(streamUrl('One'))
    await engine.playList(LIST, 0, 'digging')

    files.downloads.length = 0
    await engine.playList(LIST, 0, 'digging')

    expect(files.downloads).toEqual([streamUrl('One')])
    expect(fakePlayer.played).toEqual([])
  })
})

describe('next and previous', () => {
  it('move through the list in order', async () => {
    const { engine, fakePlayer } = setup()

    await engine.playList(LIST, 0, 'digging')
    await engine.next()
    await engine.next()
    await engine.previous()

    expect(fakePlayer.playedTitles()).toEqual(['One', 'Two', 'Three', 'Two'])
    expect(engine.getState().index).toBe(1)
  })

  it('do nothing past either end of the list', async () => {
    const { engine, fakePlayer } = setup()

    await engine.playList(LIST, 0, 'digging')
    await engine.previous()
    await engine.playList(LIST, 2, 'digging')
    await engine.next()

    expect(fakePlayer.playedTitles()).toEqual(['One', 'Three'])
    expect(engine.getState()).toMatchObject({ index: 2, nowPlaying: LIST[2] })
  })

  it('treats two quick next presses as one', async () => {
    const { engine, fakePlayer, lookups, holdLookup } = setup()
    await engine.playList(LIST, 0, NO_LOOKAHEAD)
    const lookup = holdLookup('Two')

    const first = engine.next()
    const second = engine.next()
    await lookup.release()
    await Promise.all([first, second])

    expect(fakePlayer.playedTitles()).toEqual(['One', 'Two'])
    expect(lookups()).toEqual(['One', 'Two'])
    expect(engine.getState().index).toBe(1)
  })
})

describe('when a track ends', () => {
  it('plays the next one in the list', async () => {
    const { engine, fakePlayer } = setup()

    await engine.playList(LIST, 0, 'digging')
    await engine.trackEnded()

    expect(fakePlayer.playedTitles()).toEqual(['One', 'Two'])
  })

  it('stops at the end of the list', async () => {
    const { engine, fakePlayer, lookups } = setup()

    await engine.playList(LIST, 2, 'digging')
    await engine.trackEnded()

    expect(fakePlayer.playedTitles()).toEqual(['Three'])
    expect(lookups()).toEqual(['Three'])
    expect(engine.getState()).toMatchObject({ index: 2, loadingTrack: null })
  })

  it('does not advance while a tapped track is still loading', async () => {
    const { engine, fakePlayer, holdLookup } = setup()
    await engine.playList(LIST, 0, NO_LOOKAHEAD)
    const lookup = holdLookup('Two')

    const tapped = engine.playList(LIST, 1, NO_LOOKAHEAD)
    await settle()
    // Track One reaches its end while the tapped Two is still being fetched
    await engine.trackEnded()
    await lookup.release()
    await tapped

    expect(fakePlayer.playedTitles()).toEqual(['One', 'Two'])
    expect(engine.getState()).toMatchObject({ index: 1, nowPlaying: LIST[1] })
  })
})

describe('racing requests', () => {
  it('never lets an older lookup take over from a newer tap', async () => {
    const { engine, fakePlayer, holdLookup } = setup()
    const slow = holdLookup('One')

    const first = engine.playList(LIST, 0, 'digging')
    await settle()
    // Two's lookup waits for One's: n8n only takes one at a time
    const second = engine.playList(LIST, 1, 'digging')
    await slow.release()
    await Promise.all([first, second])

    expect(fakePlayer.playedTitles()).toEqual(['Two'])
    expect(engine.getState()).toMatchObject({ index: 1, nowPlaying: LIST[1], loadingTrack: null })
  })

  it('does not report an error for a request that a newer one replaced', async () => {
    const { engine, n8n, errors, fakePlayer } = setup()
    let failNext = true
    n8n.on('stream', async request => {
      const title = (request.body as { track: string }).track
      if (failNext) {
        failNext = false
        await settle()
        return { status: 500, text: 'boom' }
      }
      return { json: { stream_url: streamUrl(title) } }
    })

    const first = engine.playList(LIST, 0, 'digging')
    await engine.playList(LIST, 1, 'digging')
    await first

    expect(errors).toEqual([])
    expect(fakePlayer.playedTitles()).toEqual(['Two'])
  })
})

describe('when tracks leave the playing list', () => {
  const FIVE = ['One', 'Two', 'Three', 'Four', 'Five'].map(track)
  const without = (...titles: string[]) => (t: QueueTrack) => titles.includes(t.title)

  it('drops them without restarting the playing track', async () => {
    const { engine, fakePlayer } = setup()
    await engine.playList(FIVE, 2, 'digging')

    engine.removeFromQueue(without('Two', 'Four'))
    await engine.next()

    expect(engine.getState().queue.map(t => t.title)).toEqual(['One', 'Three', 'Five'])
    expect(fakePlayer.playedTitles()).toEqual(['Three', 'Five'])
  })

  it('keeps playing a removed playing track and then moves on to the one after it', async () => {
    const { engine, fakePlayer } = setup()
    await engine.playList(FIVE, 2, 'digging')

    engine.removeFromQueue(without('Three'))
    expect(engine.getState().nowPlaying).toEqual(FIVE[2])
    await engine.trackEnded()

    expect(fakePlayer.playedTitles()).toEqual(['Three', 'Four'])
  })

  it('goes back to the track before a removed playing track', async () => {
    const { engine, fakePlayer } = setup()
    await engine.playList(FIVE, 2, 'digging')

    engine.removeFromQueue(without('Three'))
    await engine.previous()

    expect(fakePlayer.playedTitles()).toEqual(['Three', 'Two'])
  })

  it('reports the context the queue came from', async () => {
    const { engine } = setup()
    expect(engine.getState().context).toBeNull()

    await engine.playList(FIVE, 0, 'digging')

    expect(engine.getState().context).toBe('digging')
  })
})

describe('state updates', () => {
  it('notifies subscribers until they unsubscribe', async () => {
    const { engine } = setup()
    const seen: (string | undefined)[] = []
    const unsubscribe = engine.subscribe(() => seen.push(engine.getState().nowPlaying?.title))

    await engine.playList(LIST, 0, 'digging')
    unsubscribe()
    await engine.next()

    expect(seen.at(-1)).toBe('One')
  })

  it('stop forgets the queue and stops the player', async () => {
    const { engine, fakePlayer } = setup()
    await engine.playList(LIST, 0, 'digging')

    await engine.stop()

    expect(fakePlayer.current()).toBeNull()
    expect(engine.getState()).toMatchObject({ queue: [], index: -1, nowPlaying: null, loadingTrack: null, context: null })
  })

  it('a lookup that finishes after stop plays nothing', async () => {
    const { engine, fakePlayer, holdLookup } = setup()
    const lookup = holdLookup('One')

    const playing = engine.playList(LIST, 0, 'digging')
    await settle()
    await engine.stop()
    await lookup.release()
    await playing

    expect(fakePlayer.played).toEqual([])
    expect(engine.getState().nowPlaying).toBeNull()
  })
})

describe('playing an album', () => {
  const ALBUM = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map(track)

  it('downloads the next 3 tracks after the playing one, one lookup at a time', async () => {
    const { engine, lookups, files, mostActiveLookups } = setup()

    await engine.playList(ALBUM, 0, 'album')
    await idle()

    expect(lookups()).toEqual(['A1', 'A2', 'A3', 'A4'])
    expect(files.downloads).toEqual(['A1', 'A2', 'A3', 'A4'].map(streamUrl))
    expect(mostActiveLookups()).toBe(1)
  })

  it('plays the next track from its downloaded file and moves the window along', async () => {
    const { engine, lookups, fakePlayer } = setup()
    await engine.playList(ALBUM, 0, 'album')
    await idle()

    await engine.next()
    await idle()
    expect(fakePlayer.playedTitles()).toEqual(['A1', 'A2'])
    expect(lookups()).toEqual(['A1', 'A2', 'A3', 'A4', 'A5'])

    await engine.trackEnded()
    await idle()
    expect(fakePlayer.playedTitles()).toEqual(['A1', 'A2', 'A3'])
    expect(lookups()).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'])
  })

  it('keeps the downloaded tracks when jumping within the album', async () => {
    const { engine, lookups, fakePlayer } = setup()
    await engine.playList(ALBUM, 0, 'album')
    await idle()

    await engine.playList(ALBUM, 2, 'album')
    await idle()

    expect(fakePlayer.playedTitles()).toEqual(['A1', 'A3'])
    expect(lookups()).toEqual(['A1', 'A2', 'A3', 'A4', 'A5', 'A6'])
  })

  it('stops fetching ahead at the end of the album', async () => {
    const { engine, lookups } = setup()

    await engine.playList(ALBUM, 4, 'album')
    await idle()

    expect(lookups()).toEqual(['A5', 'A6'])
  })

  it('never overlaps a tapped track lookup with one fetched ahead', async () => {
    const { engine, lookups, fakePlayer, holdLookup, mostActiveLookups } = setup()
    const ahead = holdLookup('A2')
    await engine.playList(ALBUM, 0, 'album')
    await settle()

    const tapped = engine.playList(ALBUM, 5, 'album')
    await idle()
    expect(lookups()).toEqual(['A1', 'A2'])

    await ahead.release()
    await tapped
    expect(fakePlayer.playedTitles()).toEqual(['A1', 'A6'])
    expect(mostActiveLookups()).toBe(1)
  })

  it('drops the old window when another track is tapped', async () => {
    const { engine, lookups, holdLookup } = setup()
    const ahead = holdLookup('A2')
    await engine.playList(ALBUM, 0, 'album')
    await settle()

    const tapped = engine.playList(ALBUM, 3, 'album')
    await ahead.release()
    await tapped
    await idle()

    expect(lookups()).toEqual(['A1', 'A2', 'A4', 'A5', 'A6'])
  })

  it('carries on fetching ahead past a track that fails', async () => {
    const { engine, files, lookups } = setup()
    files.failDownloadsFrom(streamUrl('A2'))

    await engine.playList(ALBUM, 0, 'album')
    await idle()

    expect(lookups()).toEqual(['A1', 'A2', 'A3', 'A4'])
  })

  it('never lets cleanup delete the playing track or the upcoming ones', async () => {
    // Room for three 100-byte files, while the album keeps four
    const { engine, files } = setup({ maxBytes: 300 })

    await engine.playList(ALBUM, 0, 'album')
    await idle()
    expect(files.storedUrls()).toEqual(['A1', 'A2', 'A3', 'A4'].map(streamUrl))

    await engine.next()
    await idle()
    expect(files.storedUrls()).toEqual(['A2', 'A3', 'A4', 'A5'].map(streamUrl))
  })

  it('stop ends fetching ahead', async () => {
    const { engine, lookups, holdLookup } = setup()
    const ahead = holdLookup('A2')
    await engine.playList(ALBUM, 0, 'album')
    await settle()

    await engine.stop()
    await ahead.release()
    await idle()

    expect(lookups()).toEqual(['A1', 'A2'])
  })
})

describe('playing the Track Backlog', () => {
  const BACKLOG = ['T1', 'T2', 'T3', 'T4', 'T5'].map(track)

  it('downloads the next 2 tracks after the playing one, looked up as digging', async () => {
    const { engine, lookups, files, n8n, mostActiveLookups } = setup()

    await engine.playList(BACKLOG, 0, 'digging')
    await idle()

    expect(lookups()).toEqual(['T1', 'T2', 'T3'])
    expect(files.downloads).toEqual(['T1', 'T2', 'T3'].map(streamUrl))
    expect(n8n.requests.map(r => (r.body as { context: string }).context)).toEqual(['digging', 'digging', 'digging'])
    expect(mostActiveLookups()).toBe(1)
  })

  it('plays the next track from its downloaded file and moves the window along', async () => {
    const { engine, lookups, fakePlayer } = setup()
    await engine.playList(BACKLOG, 0, 'digging')
    await idle()

    await engine.next()
    await idle()

    expect(fakePlayer.playedTitles()).toEqual(['T1', 'T2'])
    expect(lookups()).toEqual(['T1', 'T2', 'T3', 'T4'])
  })
})
