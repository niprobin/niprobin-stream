import type { StreamContext, StreamTrack } from '@/services/api'
import type { TrackCache } from './trackCache'

// A track the engine can queue: what /stream needs, plus what the player
// shows about it
export type QueueTrack = StreamTrack & { coverUrl?: string; curator?: string; trackNumber?: number }

// What the player is handed: always a downloaded copy (ADR 0002)
export type PlayerTrack = {
  uri: string
  title: string
  artist: string
  artworkUrl?: string
}

// The audio element, behind an interface so tests can use a fake
export type AudioPlayer = {
  // Replaces whatever is loaded and starts playing it
  play(track: PlayerTrack): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  seekTo(seconds: number): Promise<void>
  stop(): Promise<void>
}

export type PlaybackState = {
  // The list being played through, in order
  queue: QueueTrack[]
  // The listener's position in the queue; -1 when nothing is queued. When
  // the playing track has left the queue, the position of the track after it.
  index: number
  // The track loaded in the player
  nowPlaying: QueueTrack | null
  // The track being looked up and downloaded, until it starts
  loadingTrack: QueueTrack | null
  // Where the queue came from; null when nothing is queued
  context: StreamContext | null
}

export type PlaybackEngine = {
  // Plays `tracks[startIndex]`, then continues through the list
  playList(tracks: QueueTrack[], startIndex: number, context: StreamContext): Promise<void>
  next(): Promise<void>
  previous(): Promise<void>
  // Takes tracks out of the queue (Picked or Hidden) without interrupting
  // the playing track, even when it's one of them
  removeFromQueue(isRemoved: (track: QueueTrack) => boolean): void
  // The audio element reached the end of the current track
  trackEnded(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  seekTo(seconds: number): Promise<void>
  // Stops playback and forgets the queue (logout)
  stop(): Promise<void>
  getState(): PlaybackState
  subscribe(listener: () => void): () => void
  // Messages to show the listener when a track can't be played
  onError(listener: (message: string) => void): () => void
}

// How many tracks after the playing one an album keeps in the Track Cache, so
// it plays through without gaps on a poor connection
const ALBUM_LOOKAHEAD = 3

const IDLE: PlaybackState = { queue: [], index: -1, nowPlaying: null, loadingTrack: null, context: null }

export function createPlaybackEngine({ cache, player }: { cache: TrackCache; player: AudioPlayer }): PlaybackEngine {
  let state = IDLE
  // True once the track at the listener's position has left the queue: the
  // position then sits between two tracks (see PlaybackState.index)
  let betweenTracks = false
  const listeners = new Set<() => void>()
  const errorListeners = new Set<(message: string) => void>()

  // Every track request is numbered so an older response, whose lookup or
  // download was slower, can never take over playback from a newer one.
  let latestRequest = 0
  // Next and previous come from the screen, the OS media controls and
  // a track ending, with no coordination: while one is running, the others
  // are ignored instead of all advancing from the same position.
  let navigating = false

  function setState(changes: Partial<PlaybackState>) {
    state = { ...state, ...changes }
    listeners.forEach(listener => listener())
  }

  function reportError(message: string) {
    errorListeners.forEach(listener => listener(message))
  }

  // The album tracks fetched ahead of the one at `index`
  function upcoming(index: number) {
    return state.context === 'album' ? state.queue.slice(index + 1, index + 1 + ALBUM_LOOKAHEAD) : []
  }

  async function playAt(index: number) {
    const request = ++latestRequest
    const track = state.queue[index]
    betweenTracks = false
    // The track still playing keeps its file until the new one takes over
    cache.protect([...(state.nowPlaying ? [state.nowPlaying] : []), track, ...upcoming(index)])
    setState({ index, loadingTrack: track })

    // A queued track always has a context: playList sets both together
    const result = await cache.ensure(track, state.context ?? 'digging')
    if (request !== latestRequest) return
    if (!result.ok) {
      setState({ loadingTrack: null })
      reportError(result.error)
      return
    }

    try {
      await player.play({ uri: result.uri, title: track.title, artist: track.artist, artworkUrl: track.coverUrl })
    } catch {
      if (request !== latestRequest) return
      setState({ loadingTrack: null })
      reportError("Couldn't play this track")
      return
    }
    if (request !== latestRequest) return
    setState({ nowPlaying: track, loadingTrack: null })
    cache.protect([track, ...upcoming(index)])
    void fetchAhead(request, index)
  }

  // Fetches the next tracks of an album into the Track Cache one after the
  // other, the cache keeping their lookups one at a time. Stops as soon as
  // the listener moves elsewhere, since the window then moves with them.
  async function fetchAhead(request: number, index: number) {
    for (const track of upcoming(index)) {
      if (request !== latestRequest) return
      // A failure is left for when the track is played, which retries it
      await cache.ensure(track, 'album')
    }
  }

  async function step(offset: 1 | -1) {
    if (navigating) return
    const target = betweenTracks ? (offset === 1 ? state.index : state.index - 1) : state.index + offset
    if (target < 0 || target >= state.queue.length) return

    navigating = true
    try {
      await playAt(target)
    } finally {
      navigating = false
    }
  }

  return {
    async playList(tracks, startIndex, playContext) {
      if (startIndex < 0 || startIndex >= tracks.length) return
      setState({ queue: tracks, context: playContext })
      await playAt(startIndex)
    },
    next: () => step(1),
    previous: () => step(-1),
    removeFromQueue(isRemoved) {
      const { queue, index } = state
      if (!queue.some(isRemoved)) return
      const keptBefore = queue.slice(0, Math.max(index, 0)).filter(t => !isRemoved(t)).length
      const current = queue[index]
      // A removed current track keeps playing; the position moves between
      // its neighbours so next and previous still land on them
      if (current && isRemoved(current)) betweenTracks = true
      setState({ queue: queue.filter(t => !isRemoved(t)), index: index < 0 && !betweenTracks ? -1 : keptBefore })
    },
    async trackEnded() {
      // A tapped track is on its way: let it land instead of racing it
      if (state.loadingTrack) return
      await step(1)
    },
    pause: () => player.pause(),
    resume: () => player.resume(),
    seekTo: seconds => player.seekTo(seconds),
    async stop() {
      latestRequest++
      betweenTracks = false
      cache.protect([])
      setState(IDLE)
      await player.stop()
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    onError(listener) {
      errorListeners.add(listener)
      return () => {
        errorListeners.delete(listener)
      }
    },
  }
}
