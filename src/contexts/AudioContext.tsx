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

// TypeScript: Define what our audio context contains
type AudioContextType = {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  play: (track: Track) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
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

  // Ref: Holds the actual Audio object (doesn't trigger re-renders when changed)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Function: Play a new track
  const play = (track: Track) => {
    // If no audio object exists yet, create one
    if (!audioRef.current) {
      audioRef.current = new Audio()
      
      // Listen for time updates
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0)
      })
      
      // Listen for when metadata loads (to get duration)
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0)
      })
      
      // Listen for when track ends
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false)
      })
    }

    // Set the track URL and play
    audioRef.current.src = track.streamUrl
    audioRef.current.volume = volume
    audioRef.current.play()
    
    setCurrentTrack(track)
    setIsPlaying(true)
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

  // Provide all this to children components
  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        play,
        pause,
        resume,
        seek,
        setVolume,
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}

// Custom hook to use the audio context
export function useAudio() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}