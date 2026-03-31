import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { getStreamUrl } from '@/services/api'
import { normalizeTrackId, TrackIdSource } from '@/utils/trackUtils'
import { getStreamContext } from '@/utils/urlBuilder'
import { useAuth } from '@/contexts/AuthContext'

// TypeScript: Define what a Track looks like
type Track = {
  id: string
  hashUrl?: string
  title: string
  artist: string
  album?: string
  albumId?: number
  coverArt?: string
  streamUrl: string
  spotifyId?: string
  playSource?: 'search' | 'digging' | 'album'
}

// TypeScript: Define album track for tracklist
export type AlbumTrackItem = {
  track: string
  'track-id': number
  artist: string
  'track-number': number
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
  albumInfo: { name: string; artist: string; cover: string; id?: string; streamingLink?: string } | null
  loadingState: AudioLoadingState
  play: (track: Track) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  setAlbumContext: (
    tracks: AlbumTrackItem[],
    albumInfo: { name: string; artist: string; cover: string; id?: string; streamingLink?: string },
    options?: { expand?: boolean; loadFirst?: boolean },
  ) => void
  setAutoPlayContext: (tracks: AlbumTrackItem[], startIndex: number, contextName: string, queueProvider?: QueueProvider) => void
  updateDynamicQueue: () => void
  albumAutoExpand?: boolean
  clearAlbumContext: () => void
  loadTrack: (track: Track) => void
  setLoadingState: (state: AudioLoadingState) => void
  playNextTrack: () => void
  playPreviousTrack: () => void
  currentTrackIndex: number
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
  const [albumTracks, setAlbumTracks] = useState<AlbumTrackItem[]>([])
  const [albumInfo, setAlbumInfo] = useState<{ name: string; artist: string; cover: string; id?: string; streamingLink?: string } | null>(null)
  const [albumAutoExpand, setAlbumAutoExpand] = useState(true)
  const [loadingState, setLoadingState] = useState<AudioLoadingState>({ status: 'idle' })
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [queueProvider, setQueueProvider] = useState<QueueProvider | null>(null)

  // Auth token for API requests
  const { token } = useAuth()

  // Ref: Holds the actual Audio object (doesn't trigger re-renders when changed)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  // Function: Update dynamic queue if provider is available
  const updateDynamicQueue = useCallback(() => {
    if (!queueProvider || typeof queueProvider !== 'function' || !albumInfo || albumInfo.artist !== "Auto-play") {
      return
    }

    const newTracks = queueProvider()

    if (!currentTrack) {
      setAlbumTracks(newTracks)
      setCurrentTrackIndex(0)
      return
    }

    // Find current track in updated list to maintain position
    const currentTrackKey = `${currentTrack.title}-${currentTrack.artist}`
    const newIndex = newTracks.findIndex(track =>
      `${track.track}-${track.artist}` === currentTrackKey
    )

    if (newIndex >= 0) {
      // Current track found in updated list
      setAlbumTracks(newTracks)
      setCurrentTrackIndex(newIndex)
    } else {
      // Current track not in updated list (e.g., was hidden)
      // Keep current track playing but update queue for next tracks
      setAlbumTracks(newTracks)
      // Keep current index - will naturally advance to new queue on next track
    }
  }, [queueProvider, albumInfo, currentTrack])

  // Function: Play next track in album or auto-play context
  const playNextTrack = useCallback(async () => {
    // For dynamic contexts, refresh queue before proceeding
    if (queueProvider && typeof queueProvider === 'function' && albumInfo?.artist === "Auto-play") {
      updateDynamicQueue()
    }

    if (!albumTracks || albumTracks.length === 0 || !albumInfo) {
      console.log('No album tracks available for auto-play')
      setIsPlaying(false)
      return
    }

    const nextIndex = currentTrackIndex + 1
    if (nextIndex >= albumTracks.length) {
      console.log('Reached end of auto-play context')
      setIsPlaying(false)
      return
    }

    const nextTrack = albumTracks[nextIndex]
    if (nextTrack) {
      try {
        setCurrentTrackIndex(nextIndex)

        // Determine track source and normalize track ID
        const isAutoPlayContext = albumInfo.artist === "Auto-play"
        const source = isAutoPlayContext ? TrackIdSource.Discovery : TrackIdSource.Album
        const normalizedTrackId = normalizeTrackId(
          nextTrack['track-id'],
          nextTrack.track,
          nextTrack.artist,
          source
        )

        const streamResponse = await getStreamUrl(
          normalizedTrackId,
          nextTrack.track,
          nextTrack.artist,
          token,
          getStreamContext()
        )


        startPlayback({
          id: streamResponse.trackId,
          hashUrl: streamResponse.hashUrl,
          title: streamResponse.track,
          artist: streamResponse.artist,
          album: streamResponse.album || albumInfo.name,
          albumId: streamResponse['album-id'],
          streamUrl: streamResponse.streamUrl,
          coverArt: streamResponse.cover || albumInfo.cover,
        })
      } catch (err) {
        console.error('Failed to load next track:', err)
        setIsPlaying(false)
      }
    }
  }, [currentTrackIndex, albumTracks, albumInfo, startPlayback, queueProvider, updateDynamicQueue])

  // Function: Play previous track in album or auto-play context
  const playPreviousTrack = useCallback(async () => {
    if (!albumTracks || albumTracks.length === 0 || !albumInfo) {
      console.log('No album tracks available for previous track')
      return
    }

    const prevIndex = currentTrackIndex - 1
    if (prevIndex < 0) {
      console.log('Already at first track')
      return
    }

    const prevTrack = albumTracks[prevIndex]
    if (prevTrack) {
      try {
        setCurrentTrackIndex(prevIndex)

        // Determine track source and normalize track ID (same as playNextTrack)
        const isAutoPlayContext = albumInfo.artist === "Auto-play"
        const source = isAutoPlayContext ? TrackIdSource.Discovery : TrackIdSource.Album
        const normalizedTrackId = normalizeTrackId(
          prevTrack['track-id'],
          prevTrack.track,
          prevTrack.artist,
          source
        )

        const streamResponse = await getStreamUrl(
          normalizedTrackId,
          prevTrack.track,
          prevTrack.artist,
          token,
          getStreamContext()
        )
        startPlayback({
          id: streamResponse.trackId,
          hashUrl: streamResponse.hashUrl,
          title: streamResponse.track,
          artist: streamResponse.artist,
          album: streamResponse.album || albumInfo.name,
          albumId: streamResponse['album-id'],
          streamUrl: streamResponse.streamUrl,
          coverArt: streamResponse.cover || albumInfo.cover,
        })
      } catch (err) {
        console.error('Failed to load previous track:', err)
        setIsPlaying(false)
      }
    }
  }, [currentTrackIndex, albumTracks, albumInfo, startPlayback])

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

  // Function: Set album context with tracklist
  const setAlbumContext = (
    tracks: AlbumTrackItem[],
    info: { name: string; artist: string; cover: string; id?: string; streamingLink?: string },
    options?: { expand?: boolean; loadFirst?: boolean },
  ) => {
    setAlbumTracks(tracks)
    setAlbumInfo(info)
    setAlbumAutoExpand(options?.expand ?? true)
    setCurrentTrackIndex(0)

    if (options?.loadFirst && tracks.length > 0) {
      ;(async () => {
        try {
          const first = tracks[0]
          const normalizedTrackId = normalizeTrackId(
            first['track-id'],
            first.track,
            first.artist,
            TrackIdSource.Album
          )
          const streamResponse = await getStreamUrl(normalizedTrackId, first.track, first.artist, token, getStreamContext())
          loadTrack({
            id: streamResponse.trackId,
            hashUrl: streamResponse.hashUrl,
            title: streamResponse.track,
            artist: streamResponse.artist,
            album: streamResponse.album || info.name,
            albumId: streamResponse['album-id'],
            streamUrl: streamResponse.streamUrl,
            coverArt: streamResponse.cover || info.cover,
          })
        } catch (err) {
          console.error('Failed to preload first album track', err)
        }
      })()
    }
  }

  // Function: Set auto-play context for any track list
  const setAutoPlayContext = (tracks: AlbumTrackItem[], startIndex: number, contextName: string, dynamicQueueProvider?: QueueProvider) => {
    setAlbumTracks(tracks)
    setAlbumInfo({
      name: contextName,
      artist: "Auto-play",
      cover: tracks[startIndex]?.track ? "" : "", // No cover for auto-play contexts
      id: undefined
    })
    setCurrentTrackIndex(startIndex)
    setAlbumAutoExpand(false) // Don't auto-expand for auto-play contexts
    setQueueProvider(dynamicQueueProvider || null)
  }

  // Function: Clear album context
  const clearAlbumContext = () => {
    setAlbumTracks([])
    setAlbumInfo(null)
    setCurrentTrackIndex(0)
    setQueueProvider(null)
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
        updateDynamicQueue,
        clearAlbumContext,
        albumAutoExpand,
        loadTrack,
        setLoadingState,
        playNextTrack,
        playPreviousTrack,
        currentTrackIndex,
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
