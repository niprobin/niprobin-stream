import { useAudio } from '@/contexts/AudioContext'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Play, Pause, Download } from 'lucide-react'
import { downloadTrack } from '@/services/api'
import { useState } from 'react'

export function Player() {
  const { currentTrack, isPlaying, pause, resume, currentTime, duration, seek } = useAudio()
  const [isDownloading, setIsDownloading] = useState(false)

  if (!currentTrack) {
    return null
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      pause()
    } else {
      resume()
    }
  }

  // Handle clicking on progress bar to seek
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * duration
    seek(newTime)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Download the current track
  const handleDownload = async () => {
    if (!currentTrack) return

    setIsDownloading(true)

    try {
      const blob = await downloadTrack(currentTrack.id, currentTrack.title, currentTrack.artist)
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `${currentTrack.artist} - ${currentTrack.title}.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the blob URL
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Desktop Layout: 3 columns */}
        <div className="hidden md:grid md:grid-cols-3 items-center gap-4 mb-4">
          {/* Left: Track Info */}
          <div className="text-left">
            <div className="font-semibold text-white truncate">{currentTrack.title}</div>
            <div className="text-sm text-slate-400 truncate">{currentTrack.artist}</div>
          </div>

          {/* Center: Play/Pause Button */}
          <div className="flex justify-center">
            <Button
              onClick={handlePlayPause}
              size="icon"
              variant="ghost"
              className="text-white hover:text-white hover:bg-slate-800 h-12 w-12"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>
          </div>

          {/* Right: Empty */}
          <div className="flex justify-end">
            <Button
              onClick={handleDownload}
              size="icon"
              variant="ghost"
              disabled={isDownloading}
              className="text-white hover:text-white hover:bg-slate-800"
            >
              <Download className={`h-5 w-5 ${isDownloading ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Mobile Layout: Centered */}
        <div className="md:hidden flex flex-col items-center gap-1 mb-2">
          {/* Track Info - centered, side by side */}
          <div className="text-center text-sm text-white truncate max-w-full px-4">
            <span className="font-semibold">{currentTrack.title}</span>
            <span className="text-slate-400"> • {currentTrack.artist}</span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <Button
              onClick={handlePlayPause}
              size="icon"
              variant="ghost"
              className="text-white hover:text-white hover:bg-slate-800 h-12 w-12"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
            </Button>

            {/* Download Button */}
            <Button
              onClick={handleDownload}
              size="icon"
              variant="ghost"
              disabled={isDownloading}
              className="text-white hover:text-white hover:bg-slate-800"
            >
              <Download className={`h-5 w-5 ${isDownloading ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Progress Bar - Same for both layouts */}
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <span className="text-xs text-slate-400 w-12 text-right">
            {formatTime(currentTime)}
          </span>

          <div
            className="flex-1 cursor-pointer"
            onClick={handleProgressClick}
          >
            <Progress
              value={progress}
              className="h-1 bg-white/20 [&>div]:bg-white"
            />
          </div>

          <span className="text-xs text-slate-400 w-12">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  )
}