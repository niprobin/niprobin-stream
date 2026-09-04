import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { getStreamUrl, type StreamResponse } from '@/services/api'
import { getStreamContext } from '@/utils/urlParser'
import { useAuth } from '@/contexts/AuthContext'
import { useSyncedState } from '@/hooks/useSyncedState'

type AlbumInfo = {
  name: string
  artist: string
  cover: string
  id?: string
  streamingLink?: string
}

type Track = {
  id: string
  title: string
  artist: string
  streamUrl: string
  hashUrl?: string       // set by stream endpoint; used for share links
  album?: string         // populated in album and auto-play contexts
  albumId?: number       // populated when playing from an album page
  coverArt?: string      // absent on discovery tracks with no cover
  spotifyId?: string     // legacy field; not actively populated
  playSource?: 'search' | 'digging' | 'album'
  deezer_id?: string     // preserved for like/hide payloads after stream fetch
  curator?: string       // discovery tracks only
}

// TypeScript: Define album track for tracklist
export type AlbumTrackItem = {
  track: string
  deezer_id: string
  artist: string
  'track-number': number
  date?: string
  // Optional metadata for discovery tracks and external integrations
  curator?: string
}

// TypeScript: Define loading states for audio player
export type AudioLoadingState =
  | { status: 'idle' }
  | { status: 'fetching-stream', trackId: string }
  | { status: 'buffering', trackId: string }
  | { status: 'ready', trackId: string }
  | { status: 'error', trackId: string, error?: string }

// TypeScript: Define dynamic queue provider function type
type QueueProvider = () => AlbumTrackItem[]

// TypeScript: Define what our audio context contains
type AudioContextType = {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  albumTracks: AlbumTrackItem[]
  albumInfo: AlbumInfo | null
  loadingState: AudioLoadingState
  play: (track: Track) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  setAlbumContext: (
    tracks: AlbumTrackItem[],
    albumInfo: AlbumInfo,
    options?: { expand?: boolean; loadFirst?: boolean; startIndex?: number },
  ) => void
  setAutoPlayContext: (tracks: AlbumTrackItem[], startIndex: number, contextName: string, queueProvider?: QueueProvider) => void
  setQueuePosition: (index: number) => void
  updateDynamicQueue: () => void
  albumAutoExpand?: boolean
  clearAlbumContext: () => void
  loadTrack: (track: Track) => void
  setLoadingState: (state: AudioLoadingState) => void
  loadAndPlayTrack: (opts: {
    item: { track: string; artist: string; deezer_id?: string; curator?: string }
    albumInfoForFallback: AlbumInfo | null
    onlyLoad?: boolean
    useCache?: boolean
  }) => Promise<'played' | 'stale' | 'error'>
  playNextTrack: () => void
  playPreviousTrack: () => void
  currentTrackIndex: number
  beginTrackRequest: () => number
  isLatestTrackRequest: (id: number) => boolean
  isNavInFlight: boolean
  beginManualLoad: () => void
  endManualLoad: () => void
}

// Create the Context - this is our "box" that holds audio state
const AudioContext = createContext<AudioContextType | undefined>(undefined)

// Provider component - wraps your app and provides the audio functionality
export function AudioProvider({ children }: { children: ReactNode }) {
  // State: Data that can change and trigger re-renders
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1) // 0 to 1
  const [albumTracks, updateAlbumTracks, albumTracksRef] = useSyncedState<AlbumTrackItem[]>([])
  const [albumInfo, updateAlbumInfo, albumInfoRef] = useSyncedState<AlbumInfo | null>(null)
  const [albumAutoExpand, setAlbumAutoExpand] = useState(true)
  const [loadingState, setLoadingState] = useState<AudioLoadingState>({ status: 'idle' })
  const [currentTrackIndex, updateCurrentTrackIndex, currentTrackIndexRef] = useSyncedState(0)
  const [, updateQueueProvider, queueProviderRef] = useSyncedState<QueueProvider | null>(null)

  // Auth token for API requests
  const { token } = useAuth()

  // Ref: Holds the actual Audio object (doesn't trigger re-renders when changed)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Cache for pre-fetched stream URLs keyed by deezer_id
  const prefetchCacheRef = useRef<Map<string, StreamResponse>>(new Map())
  // In-flight prefetch requests keyed by deezer_id, so a consumer that needs
  // the same track can await the existing request instead of firing a
  // duplicate fetch.
  const prefetchInFlightRef = useRef<Map<string, Promise<StreamResponse>>>(new Map())

  // Monotonic ticket guarding against out-of-order stream responses: two
  // track loads can be in flight at once (e.g. user clicks track N then N+1
  // before N's lookup resolves), and lookup latency varies per track, so the
  // slower response can otherwise arrive last and overwrite newer playback.
  const trackRequestIdRef = useRef(0)
  const beginTrackRequest = useCallback(() => {
    trackRequestIdRef.current += 1
    return trackRequestIdRef.current
  }, [])
  const isLatestTrackRequest = useCallback((id: number) => id === trackRequestIdRef.current, [])

  // albumTracksRef/currentTrackIndexRef/albumInfoRef/queueProviderRef (from
  // useSyncedState above) are the synchronous-read side of this state:
  // playNextTrack/playPreviousTrack read them mid-call, where a setState
  // made earlier in the same call (or by a helper it calls, like the
  // dynamic-queue refresh) wouldn't yet be reflected in a plain useState
  // closure.

  // True while a Next/Previous navigation is in flight. Next/Previous can be
  // triggered from four independent places — the player buttons, swipe
  // gestures, a track ending naturally, and OS/hardware media keys — with no
  // coordination between them. This lock makes a second call while one is
  // already running a no-op, instead of both acting on the same
  // not-yet-advanced position and landing on the same track.
  const navInFlightRef = useRef(false)
  const [isNavInFlight, setIsNavInFlight] = useState(false)

  // Counts manual, click-driven track loads currently in flight (see
  // useTrackPlayer.playTrack). While this is above zero, the natural 'ended'
  // event must not trigger auto-advance: the still-playing old track can
  // reach its real end while a manual click's stream lookup is in flight, and
  // since the auto-advance's lookup is usually served from the prefetch
  // cache, it resolves near-instantly and wins the ticket race — silently
  // dropping the click's result once it arrives. A counter (not a boolean)
  // so two overlapping manual loads don't let the first one's cleanup
  // re-enable 'ended' while the second is still pending. Always
  // incremented/decremented in try/finally at the call site so it can never
  // get stuck regardless of which branch runs.
  const manualLoadInFlightRef = useRef(0)
  const beginManualLoad = useCallback(() => {
    manualLoadInFlightRef.current += 1
  }, [])
  const endManualLoad = useCallback(() => {
    manualLoadInFlightRef.current = Math.max(0, manualLoadInFlightRef.current - 1)
  }, [])

  const startPlayback = useCallback(
    (track: Track) => {

      if (typeof Audio === 'undefined') {
        return
      }

      if (!audioRef.current) {
        audioRef.current = new Audio()
      }

      const audio = audioRef.current
      audio.src = track.streamUrl
      audio.volume = volume
      audio.play()

      setCurrentTrack(track)
      setIsPlaying(true)

      // Simple loading state: set to buffering when starting playback
      setLoadingState({ status: 'buffering', trackId: track.id })


      // Update Media Session metadata/controls for current track
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          artwork: track.coverArt
            ? [{ src: track.coverArt, sizes: '512x512', type: 'image/png' }]
            : [],
        })

        navigator.mediaSession.setActionHandler('play', () => {
          audioRef.current?.play()
          setIsPlaying(true)
        })

        navigator.mediaSession.setActionHandler('pause', () => {
          audioRef.current?.pause()
          setIsPlaying(false)
        })

        navigator.mediaSession.setActionHandler('seekbackward', () => {
          if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10)
          }
        })

        navigator.mediaSession.setActionHandler('seekforward', () => {
          if (audioRef.current) {
            audioRef.current.currentTime = Math.min(
              audioRef.current.duration,
              audioRef.current.currentTime + 10
            )
          }
        })
      }
    },
    [volume]
  )

  // Function: Load track metadata without playing
  const loadTrack = useCallback(
    (track: Track) => {
      // Set track metadata but don't start playback
      setCurrentTrack(track)
      setIsPlaying(false)


      // Initialize audio element with source but don't play
      if (typeof Audio === 'undefined') return

      if (!audioRef.current) {
        audioRef.current = new Audio()
      }

      audioRef.current.src = track.streamUrl
      audioRef.current.volume = volume

      // Set Media Session metadata for lock screen/notification controls
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: track.album || '',
          artwork: track.coverArt
            ? [{ src: track.coverArt, sizes: '512x512', type: 'image/png' }]
            : [],
        })
      }
    },
    [volume]
  )

  // Pure calculation of the corrected dynamic queue/position for "Auto-play"
  // contexts (Digging/Search/Home), with no side effects — callers decide
  // whether to apply it via the update* helpers and/or use it immediately.
  const computeDynamicQueue = useCallback((): { tracks: AlbumTrackItem[]; index: number } | null => {
    const provider = queueProviderRef.current
    const info = albumInfoRef.current
    if (!provider || typeof provider !== 'function' || !info || info.artist !== "Auto-play") {
      return null
    }

    const newTracks = provider()

    if (!currentTrack) {
      return { tracks: newTracks, index: 0 }
    }

    // Find current track in updated list to maintain position
    const currentTrackKey = `${currentTrack.title}-${currentTrack.artist}`
    const newIndex = newTracks.findIndex(track =>
      `${track.track}-${track.artist}` === currentTrackKey
    )

    // If not found (e.g. it was hidden), keep the current position — it'll
    // naturally land on the right track once the queue includes it again.
    return {
      tracks: newTracks,
      index: newIndex >= 0 ? newIndex : currentTrackIndexRef.current,
    }
  }, [currentTrack])

  // Function: Update dynamic queue if provider is available
  const updateDynamicQueue = useCallback(() => {
    const result = computeDynamicQueue()
    if (!result) return
    updateAlbumTracks(result.tracks)
    updateCurrentTrackIndex(result.index)
  }, [computeDynamicQueue, updateAlbumTracks, updateCurrentTrackIndex])

  // Cache/in-flight maps are keyed on more than deezer_id: two different
  // rows in the same album can carry the same deezer_id (bonus/live/intro
  // duplicates matched to the same catalog entry during curation) or both
  // have it missing, and a deezer_id-only key would then serve one track's
  // cached response to the other. Composing in track+artist makes that
  // collision impossible even when deezer_id can't be trusted to be unique.
  const trackCacheKey = useCallback(
    (item: { track: string; artist: string; deezer_id?: string }) =>
      `${item.deezer_id || ''}::${item.track}::${item.artist}`,
    []
  )

  // Silently pre-fetches the stream URL for the track after `fromIndex`.
  // Any failure is swallowed — this must never affect current playback.
  const prefetchNext = useCallback(async (fromIndex: number) => {
    const next = albumTracks[fromIndex + 1]
    if (!next?.deezer_id) return
    const key = trackCacheKey(next)
    if (prefetchCacheRef.current.has(key)) return
    if (prefetchInFlightRef.current.has(key)) return
    const promise = getStreamUrl(next.deezer_id, next.track, next.artist, token, getStreamContext())
    prefetchInFlightRef.current.set(key, promise)
    try {
      const res = await promise
      prefetchCacheRef.current.set(key, res)
    } catch {
      // intentionally silent
    } finally {
      prefetchInFlightRef.current.delete(key)
    }
  }, [albumTracks, token, trackCacheKey])

  // Shared "fetch a track's stream URL, then play or load it" logic, used by
  // playNextTrack, playPreviousTrack, and the first-track preload in
  // setAlbumContext — previously duplicated three times with near-identical
  // shape, which is how the stale-response bug slipped into one path first.
  const loadAndPlayTrack = useCallback(async (opts: {
    item: { track: string; artist: string; deezer_id?: string; curator?: string }
    albumInfoForFallback: AlbumInfo | null
    onlyLoad?: boolean
    useCache?: boolean
  }): Promise<'played' | 'stale' | 'error'> => {
    const { item, albumInfoForFallback, onlyLoad = false, useCache = false } = opts
    const requestId = beginTrackRequest()
    const id = item.deezer_id || ''
    const key = trackCacheKey(item)

    try {
      let streamResponse: StreamResponse
      if (useCache && prefetchCacheRef.current.has(key)) {
        streamResponse = prefetchCacheRef.current.get(key)!
        prefetchCacheRef.current.delete(key)
      } else {
        const inFlight = prefetchInFlightRef.current.get(key)
        streamResponse = inFlight
          ? await inFlight
          : await getStreamUrl(id || '0', item.track, item.artist, token, getStreamContext())
      }

      // A newer track change (another click, Next/Prev, etc.) started after
      // this one — this response is stale, don't let it hijack playback.
      if (!isLatestTrackRequest(requestId)) return 'stale'

      const track: Track = {
        id: streamResponse.trackId,
        hashUrl: streamResponse.hashUrl,
        title: streamResponse.track,
        artist: streamResponse.artist,
        album: streamResponse.album || albumInfoForFallback?.name,
        albumId: streamResponse['album-id'],
        streamUrl: streamResponse.streamUrl,
        coverArt: albumInfoForFallback?.cover || streamResponse.cover,
        deezer_id: item.deezer_id,
        curator: item.curator,
      }

      if (onlyLoad) {
        loadTrack(track)
      } else {
        startPlayback(track)
      }
      return 'played'
    } catch (err) {
      console.error('Failed to load track:', err)
      return isLatestTrackRequest(requestId) ? 'error' : 'stale'
    }
  }, [token, beginTrackRequest, isLatestTrackRequest, loadTrack, startPlayback, trackCacheKey])

  // Function: Play next track in album or auto-play context
  const playNextTrack = useCallback(async () => {
    if (navInFlightRef.current) return // a navigation is already in flight — ignore
    navInFlightRef.current = true
    setIsNavInFlight(true)

    try {
      // For dynamic contexts, refresh the queue and use the corrected
      // tracks/index immediately, in this same call — not the stale
      // pre-refresh values, which is what let auto-play queues desync.
      const dynamic = computeDynamicQueue()
      let tracks = albumTracksRef.current
      let baseIndex = currentTrackIndexRef.current
      if (dynamic) {
        updateAlbumTracks(dynamic.tracks)
        updateCurrentTrackIndex(dynamic.index)
        tracks = dynamic.tracks
        baseIndex = dynamic.index
      }

      if (!tracks || tracks.length === 0 || !albumInfoRef.current) {
        console.log('No album tracks available for auto-play')
        setIsPlaying(false)
        return
      }

      const nextIndex = baseIndex + 1
      if (nextIndex >= tracks.length) {
        console.log('Reached end of auto-play context')
        setIsPlaying(false)
        return
      }

      const nextTrack = tracks[nextIndex]
      updateCurrentTrackIndex(nextIndex)

      const result = await loadAndPlayTrack({
        item: nextTrack,
        albumInfoForFallback: albumInfoRef.current,
        useCache: true,
      })
      if (result === 'error') setIsPlaying(false)
    } finally {
      navInFlightRef.current = false
      setIsNavInFlight(false)
    }
  }, [computeDynamicQueue, loadAndPlayTrack, updateAlbumTracks, updateCurrentTrackIndex])

  // Function: Play previous track in album or auto-play context
  const playPreviousTrack = useCallback(async () => {
    if (navInFlightRef.current) return // a navigation is already in flight — ignore
    navInFlightRef.current = true
    setIsNavInFlight(true)

    try {
      // Same dynamic-queue correction as playNextTrack, for symmetry.
      const dynamic = computeDynamicQueue()
      let tracks = albumTracksRef.current
      let baseIndex = currentTrackIndexRef.current
      if (dynamic) {
        updateAlbumTracks(dynamic.tracks)
        updateCurrentTrackIndex(dynamic.index)
        tracks = dynamic.tracks
        baseIndex = dynamic.index
      }

      if (!tracks || tracks.length === 0 || !albumInfoRef.current) {
        console.log('No album tracks available for previous track')
        return
      }

      const prevIndex = baseIndex - 1
      if (prevIndex < 0) {
        console.log('Already at first track')
        return
      }

      const prevTrack = tracks[prevIndex]
      updateCurrentTrackIndex(prevIndex)

      const result = await loadAndPlayTrack({
        item: prevTrack,
        albumInfoForFallback: albumInfoRef.current,
      })
      if (result === 'error') setIsPlaying(false)
    } finally {
      navInFlightRef.current = false
      setIsNavInFlight(false)
    }
  }, [computeDynamicQueue, loadAndPlayTrack, updateAlbumTracks, updateCurrentTrackIndex])

  // Initialize audio element and bind lifecycle events once
  useEffect(() => {
    if (typeof Audio === 'undefined') {
      return
    }

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0)
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0)
    }

    const handleEnded = () => {
      // A manual click is already fetching its stream — let it land instead
      // of racing it with an auto-advance (see manualLoadInFlightRef above).
      if (manualLoadInFlightRef.current > 0) return
      void playNextTrack()
    }

    // Simple loading state event handlers
    const handleCanPlay = () => {
      // Audio is ready to play - clear loading state
      setLoadingState({ status: 'idle' })
    }

    const handlePlay = () => {
      // Audio started playing - clear loading state
      setLoadingState({ status: 'idle' })
    }

    const handleError = () => {
      // Audio loading error
      setLoadingState({ status: 'idle' })
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('error', handleError)
    }
  }, [playNextTrack])

  // Set up MediaSession navigation handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        void playPreviousTrack()
      })

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        void playNextTrack()
      })
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('previoustrack', null)
        navigator.mediaSession.setActionHandler('nexttrack', null)
      }
    }
  }, [playPreviousTrack, playNextTrack])

  // Prefetch the next track's stream URL whenever the current track index,
  // playback state, or the track list itself changes — covers the first
  // track in any new queue and re-targets correctly if the queue shifts.
  useEffect(() => {
    if (!isPlaying || albumTracks.length === 0) return
    void prefetchNext(currentTrackIndex)
  }, [currentTrackIndex, isPlaying, albumTracks, prefetchNext])

  // URL sync removed: tracks are not encoded into the URL anymore.

  // Function: Play a new track
  const play = startPlayback

  // Function: Pause playback
  const pause = () => {
    audioRef.current?.pause()
    setIsPlaying(false)
  }

  // Function: Resume playback
  const resume = () => {
    audioRef.current?.play()
    setIsPlaying(true)
  }

  // Function: Seek to a specific time
  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // Function: Change volume
  const setVolume = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
    setVolumeState(newVolume)
  }

  // Function: Set album context with tracklist
  const setAlbumContext = (
    tracks: AlbumTrackItem[],
    info: AlbumInfo,
    options?: { expand?: boolean; loadFirst?: boolean; startIndex?: number },
  ) => {
    // Repositioning within the same album (e.g. clicking another row) should
    // keep whatever's already prefetched — only a real album switch should
    // discard it. Otherwise every click threw away the cache the app had
    // just fetched, defeating the point of prefetching.
    const isSameAlbum = info.id !== undefined && info.id === albumInfoRef.current?.id
    if (!isSameAlbum) {
      prefetchCacheRef.current.clear()
      prefetchInFlightRef.current.clear()
    }
    updateAlbumTracks(tracks)
    updateAlbumInfo(info)
    setAlbumAutoExpand(options?.expand ?? true)
    updateCurrentTrackIndex(options?.startIndex ?? 0)

    if (options?.loadFirst && tracks.length > 0) {
      void loadAndPlayTrack({ item: tracks[0], albumInfoForFallback: info, onlyLoad: true })
    }
  }

  // Function: Reposition within the current queue (album or auto-play)
  // without touching albumInfo/albumTracks/queueProvider — used when the
  // user picks a track from a list that already reflects the active
  // context, so its real metadata (cover, artist) and dynamic queue
  // provider must survive the click.
  const setQueuePosition = useCallback((index: number) => {
    updateCurrentTrackIndex(index)
  }, [updateCurrentTrackIndex])

  // Function: Set auto-play context for any track list
  const setAutoPlayContext = (tracks: AlbumTrackItem[], startIndex: number, contextName: string, dynamicQueueProvider?: QueueProvider) => {
    prefetchCacheRef.current.clear()
    prefetchInFlightRef.current.clear()
    updateAlbumTracks(tracks)
    updateAlbumInfo({
      name: contextName,
      artist: "Auto-play",
      cover: tracks[startIndex]?.track ? "" : "", // No cover for auto-play contexts
      id: undefined
    })
    updateCurrentTrackIndex(startIndex)
    setAlbumAutoExpand(false) // Don't auto-expand for auto-play contexts
    updateQueueProvider(dynamicQueueProvider || null)
  }

  // Function: Clear album context
  const clearAlbumContext = () => {
    updateAlbumTracks([])
    updateAlbumInfo(null)
    updateCurrentTrackIndex(0)
    updateQueueProvider(null)
  }

  // Provide all this to children components
  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        albumTracks,
        albumInfo,
        loadingState,
        play,
        pause,
        resume,
        seek,
        setVolume,
        setAlbumContext,
        setAutoPlayContext,
        setQueuePosition,
        updateDynamicQueue,
        clearAlbumContext,
        albumAutoExpand,
        loadTrack,
        setLoadingState,
        loadAndPlayTrack,
        playNextTrack,
        playPreviousTrack,
        currentTrackIndex,
        beginTrackRequest,
        isLatestTrackRequest,
        isNavInFlight,
        beginManualLoad,
        endManualLoad,
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}

// Custom hook to use the audio context
// eslint-disable-next-line react-refresh/only-export-components
export const useAudio = () => {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}
