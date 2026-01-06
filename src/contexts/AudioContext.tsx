import { createContext, useContext, useState, useRef } from 'react'
import type { ReactNode } from 'react'

// TypeScript: Define what a Track looks like
type Track = {
  id: string
  title: string
  artist: string
  album?: string
  coverArt?: string
  streamUrl: string
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

  // Function: Play a new track
  const play = (track: Track) => {
    if (!audioRef.current) {
      audioRef.current = new Audio()

      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0)
      })

      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0)
      })

      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
      })
    }

    audioRef.current.src = track.streamUrl
    audioRef.current.volume = volume
    audioRef.current.play()

    setCurrentTrack(track)
    setIsPlaying(true)

    // Update Media Session
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        artwork: track.coverArt ? [
          { src: track.coverArt, sizes: '512x512', type: 'image/png' }
        ] : []
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
          audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 10)
        }
      })
    }
  }

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