import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { getStreamUrl } from '@/services/api'

// TypeScript: Define what a Track looks like
type Track = {
  id: string
  title: string
  artist: string
  album?: string
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

// TypeScript: Define what our audio context contains
type AudioContextType = {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  albumTracks: AlbumTrackItem[]
  albumInfo: { name: string; artist: string; cover: string } | null
  play: (track: Track) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  setAlbumContext: (tracks: AlbumTrackItem[], albumInfo: { name: string; artist: string; cover: string }) => void
  clearAlbumContext: () => void
  loadTrack: (track: Track) => void
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
  const [albumInfo, setAlbumInfo] = useState<{ name: string; artist: string; cover: string } | null>(null)

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

  // Function: Play next track in album
  const playNextTrack = useCallback(async () => {
    if (!currentTrack || albumTracks.length === 0 || !albumInfo) {
      setIsPlaying(false)
      return
    }

    const currentIndex = albumTracks.findIndex(
      (track) => track['track-id'].toString() === currentTrack.id
    )

    if (currentIndex !== -1 && currentIndex < albumTracks.length - 1) {
      const nextTrack = albumTracks[currentIndex + 1]

      try {
        const streamUrl = await getStreamUrl(
          nextTrack['track-id'],
          nextTrack.track,
          nextTrack.artist
        )
        startPlayback({
          id: nextTrack['track-id'].toString(),
          title: nextTrack.track,
          artist: nextTrack.artist,
          album: albumInfo.name,
          streamUrl,
          coverArt: albumInfo.cover,
        })
      } catch (err) {
        console.error('Failed to load next track:', err)
        setIsPlaying(false)
      }
    } else {
      setIsPlaying(false)
    }
  }, [currentTrack, albumTracks, albumInfo, startPlayback])

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

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [playNextTrack])

  // Sync URL with currently playing track (only for search tracks)
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (currentTrack && currentTrack.playSource === 'search') {
      // Create Base64 encoded string from "artist track" (lowercase, no separator)
      const trackString = `${currentTrack.artist} ${currentTrack.title}`.toLowerCase()
      const encoded = btoa(trackString)
      const newPath = `/track/${encoded}`

      // Only update if URL actually changed
      if (window.location.pathname !== newPath) {
        window.history.pushState({}, '', newPath)
      }
    }
  }, [currentTrack])

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
  const setAlbumContext = (tracks: AlbumTrackItem[], info: { name: string; artist: string; cover: string }) => {
    setAlbumTracks(tracks)
    setAlbumInfo(info)
  }

  // Function: Clear album context
  const clearAlbumContext = () => {
    setAlbumTracks([])
    setAlbumInfo(null)
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
        play,
        pause,
        resume,
        seek,
        setVolume,
        setAlbumContext,
        clearAlbumContext,
        loadTrack,
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
