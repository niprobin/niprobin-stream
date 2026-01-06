import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Play, Pause, Download, Maximize2 } from 'lucide-react'
import { downloadTrack, getStreamUrl } from '@/services/api'
import { useState, useEffect, useRef } from 'react'

export function Player() {
  const { currentTrack, isPlaying, pause, resume, currentTime, duration, seek, albumTracks, albumInfo, play } = useAudio()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const playerRef = useRef<HTMLDivElement>(null)

  // Auto-expand when album context is set
  const hasAlbumContext = albumTracks.length > 0 && albumInfo

  // Automatically expand player when album context is populated
  useEffect(() => {
    if (hasAlbumContext) {
      setIsExpanded(true)
    }
  }, [hasAlbumContext])

  // Handle click outside to collapse player
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isExpanded && playerRef.current && !playerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded])

  // Determine height based on expand state
  const playerHeight = hasAlbumContext && isExpanded ? 'h-[80vh]' : 'h-auto'

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

  // Handle clicking a track from the album tracklist
  const handlePlayAlbumTrack = async (track: AlbumTrackItem) => {
    if (!albumInfo) return

    setLoadingTrackId(track['track-id'].toString())

    try {
      const streamUrl = await getStreamUrl(track['track-id'].toString())
      play({
        id: track['track-id'].toString(),
        title: track.track,
        artist: track.artist,
        album: albumInfo.name,
        streamUrl: streamUrl,
        coverArt: albumInfo.cover,
      })
    } catch (err) {
      console.error('Failed to load track:', err)
    } finally {
      setLoadingTrackId(null)
    }
  }

  // Toggle expand/collapse
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div ref={playerRef} className={`fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 md:p-6 transition-all duration-300 ${playerHeight} overflow-hidden flex flex-col`}>
      <div className="max-w-4xl mx-auto flex-shrink-0 w-full">
        {currentTrack ? (
          <>
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
                  className="bg-white text-black rounded-full h-12 w-12"
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
              </div>

              {/* Right: Buttons */}
              <div className="flex justify-end gap-2">
                {hasAlbumContext && (
                  <Button
                    onClick={toggleExpand}
                    size="icon"
                    variant="ghost"
                    className="text-white hover:text-white hover:bg-slate-800"
                  >
                    <Maximize2 className="h-5 w-5" />
                  </Button>
                )}
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
                <span className="text-slate-400"> – {currentTrack.artist}</span>
              </div>

              {/* Buttons Row */}
              <div className="flex items-center gap-2 mb-2 mt-2">
                
                {/* Show Album Button */}
                {hasAlbumContext && (
                  <Button
                    onClick={toggleExpand}
                    size="icon"
                    variant="ghost"
                    className="text-white hover:text-white hover:bg-slate-800"
                  >
                    <Maximize2 className="h-5 w-5" />
                  </Button>
                )}
                
                {/* Play/Pause Button */}
                <Button
                  onClick={handlePlayPause}
                  size="icon"
                  variant="ghost"
                  className="bg-white rounded-full text-black h-10 w-10"
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
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2">
            <div className="text-center text-slate-400">
              No track playing
            </div>
            {hasAlbumContext && (
              <Button
                onClick={toggleExpand}
                size="icon"
                variant="ghost"
                className="text-white hover:text-white hover:bg-slate-800"
              >
                <Maximize2 className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Album Tracklist - Only visible when expanded */}
      {hasAlbumContext && isExpanded && (
        <div className="flex-1 overflow-hidden max-w-4xl mx-auto w-full pt-8">
          {/* Album Header */}
          <div className="flex gap-4 px-2 p-3 bg-slate-800">
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
              <img
                src={albumInfo.cover}
                alt={`${albumInfo.name} cover`}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white line-clamp-1 mb-1">
                {albumInfo.name}
              </h3>
              <p className="text-sm text-slate-400">{albumInfo.artist}</p>
            </div>
          </div>

          {/* Track List */}
          <div className="divide-y divide-slate-800 overflow-y-auto max-h-full">
            {albumTracks.map((track, index) => {
              const isCurrentTrack = currentTrack?.id === track['track-id'].toString()
              return (
                <div
                  key={`${track['track-id']}-${index}`}
                  onClick={() => handlePlayAlbumTrack(track)}
                  className={`flex items-center gap-2 p-2 hover:bg-slate-800 cursor-pointer transition-colors group ${
                    isCurrentTrack ? 'bg-slate-800' : ''
                  }`}
                >
                  {/* Track Number */}
                  <div className={`text-xs font-medium w-6 text-right group-hover:text-white transition-colors ${
                    isCurrentTrack ? 'text-white' : 'text-slate-500'
                  }`}>
                    {track['track-number']}
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${
                      isCurrentTrack ? 'text-white' : 'text-white'
                    }`}>
                      {track.track}
                    </div>
                    <div className="text-slate-400 text-xs truncate">
                      {track.artist}
                    </div>
                  </div>

                  {/* Loading or Playing Indicator */}
                  {loadingTrackId === track['track-id'].toString() && (
                    <div className="text-slate-400 text-xs">
                      Loading...
                    </div>
                  )}
                  {isCurrentTrack && !loadingTrackId && (
                    <div className="text-white text-xs">
                      {isPlaying ? '▶' : '❚❚'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}