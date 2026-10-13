import { createContext, useContext, useState, useEffect, useMemo, useRef, useSyncExternalStore, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { StreamContext, StreamDetails } from '@/services/api'
import { getStreamContext } from '@/utils/urlParser'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { audioElement, playbackEngine, resetPlayback, setPlaybackToken, streamDetails } from '@/playback/appEngine'
import type { QueueTrack } from '@/playback/engine'

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
  hashUrl?: string       // set by stream endpoint; used for share links
  album?: string
  albumId?: number       // links the player to the album page
  coverArt?: string      // absent on discovery tracks with no cover
  spotifyId?: string     // legacy field; not actively populated
  deezer_id?: string     // preserved for like/hide payloads
  curator?: string       // discovery tracks only
}

export type AlbumTrackItem = {
  track: string
  deezer_id: string
  artist: string
  'track-number': number
  date?: string
  // Optional metadata for discovery tracks and external integrations
  curator?: string
  cover?: string
}

// What the player shows above a queue that isn't an album
// eslint-disable-next-line react-refresh/only-export-components
export function autoPlayInfo(name: string): AlbumInfo {
  return { name, artist: 'Auto-play', cover: '' }
}

type AudioContextType = {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  // The queue being played through, and where the listener is in it
  albumTracks: AlbumTrackItem[]
  albumInfo: AlbumInfo | null
  currentTrackIndex: number
  // The deezer_id of the track being looked up and downloaded, until it starts
  loadingTrackId: string | null
  isNavInFlight: boolean
  // Plays `tracks[startIndex]`, then continues through the list
  playList: (tracks: AlbumTrackItem[], startIndex: number, info: AlbumInfo) => void
  // Shows a track in the player, paused, without fetching it until Play
  cueTrack: (track: AlbumTrackItem, details: StreamDetails) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  playNextTrack: () => void
  playPreviousTrack: () => void
  // Takes tracks out of the queue (e.g. Hidden) without interrupting playback
  removeFromQueue: (isRemoved: (track: AlbumTrackItem) => boolean) => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

function toQueueTrack(item: AlbumTrackItem, info: AlbumInfo): QueueTrack {
  return {
    deezerId: item.deezer_id || '',
    title: item.track,
    artist: item.artist,
    coverUrl: item.cover || info.cover || undefined,
    curator: item.curator,
    trackNumber: item['track-number'],
  }
}

function toAlbumTrackItem(track: QueueTrack, index: number): AlbumTrackItem {
  return {
    track: track.title,
    deezer_id: track.deezerId,
    artist: track.artist,
    'track-number': track.trackNumber ?? index + 1,
    curator: track.curator,
    cover: track.coverUrl,
  }
}

function toTrack(track: QueueTrack, details: StreamDetails | undefined): Track {
  return {
    id: details?.trackId ?? track.deezerId,
    title: details?.title ?? track.title,
    artist: details?.artist ?? track.artist,
    hashUrl: details?.hashUrl,
    album: details?.album,
    albumId: details?.albumId,
    coverArt: track.coverUrl || details?.cover,
    deezer_id: track.deezerId || undefined,
    curator: track.curator,
  }
}

// A thin React layer over the playback engine (src/playback/engine.ts),
// which owns the queue, the lookups and the downloads
export function AudioProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(playbackEngine.subscribe, playbackEngine.getState)
  const [albumInfo, setAlbumInfo] = useState<AlbumInfo | null>(null)
  const [cued, setCued] = useState<{ track: QueueTrack; details: StreamDetails } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const { token } = useAuth()
  const { showNotification } = useNotification()

  // Logout stops playback; a guest playing from Search has no token to lose
  const previousToken = useRef(token)
  useEffect(() => {
    setPlaybackToken(token)
    if (previousToken.current && !token) void resetPlayback()
    previousToken.current = token
  }, [token])

  useEffect(() => playbackEngine.onError(message => showNotification(message, 'error')), [showNotification])

  useEffect(() => {
    const audio = audioElement
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0)
    const onDurationChange = () => setDuration(audio.duration || 0)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onPause)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onPause)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
    }
  }, [])

  const currentTrack = useMemo(() => {
    if (state.nowPlaying) return toTrack(state.nowPlaying, streamDetails(state.nowPlaying))
    return cued ? toTrack(cued.track, cued.details) : null
  }, [state.nowPlaying, cued])

  const albumTracks = useMemo(() => state.queue.map(toAlbumTrackItem), [state.queue])

  const playList = useCallback((tracks: AlbumTrackItem[], startIndex: number, info: AlbumInfo) => {
    setCued(null)
    setAlbumInfo(info)
    void playbackEngine.playList(
      tracks.map(item => toQueueTrack(item, info)),
      startIndex,
      getStreamContext() as StreamContext,
    )
  }, [])

  const cueTrack = useCallback((item: AlbumTrackItem, details: StreamDetails) => {
    setCued({ track: toQueueTrack(item, autoPlayInfo('')), details })
  }, [])

  const resume = useCallback(() => {
    if (!state.nowPlaying && cued) {
      setAlbumInfo(autoPlayInfo('Shared track'))
      void playbackEngine.playList([cued.track], 0, 'search')
      setCued(null)
      return
    }
    // Rejects when nothing is loaded yet
    playbackEngine.resume().catch(() => {})
  }, [state.nowPlaying, cued])

  const removeFromQueue = useCallback((isRemoved: (track: AlbumTrackItem) => boolean) => {
    playbackEngine.removeFromQueue(track => isRemoved(toAlbumTrackItem(track, 0)))
  }, [])

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        albumTracks,
        albumInfo: state.queue.length > 0 ? albumInfo : null,
        currentTrackIndex: Math.max(state.index, 0),
        loadingTrackId: state.loadingTrack ? state.loadingTrack.deezerId || '0' : null,
        isNavInFlight: state.loadingTrack !== null,
        playList,
        cueTrack,
        pause: () => void playbackEngine.pause(),
        resume,
        seek: (time: number) => {
          void playbackEngine.seekTo(time)
          setCurrentTime(time)
        },
        playNextTrack: () => void playbackEngine.next(),
        playPreviousTrack: () => void playbackEngine.previous(),
        removeFromQueue,
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAudio = () => {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}
