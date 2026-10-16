import { useEffect } from 'react'
import { useAudio } from '@/contexts/AudioContext'
import { isPlayPauseShortcut } from '@/lib/playPauseShortcut'

// Space plays and pauses the player from anywhere on the page
export function usePlayPauseShortcut() {
  const { isPlaying, pause, resume } = useAudio()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPlayPauseShortcut(event)) return
      // No page scroll, and no click on the focused button
      event.preventDefault()
      if (isPlaying) pause()
      else resume()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, pause, resume])
}
