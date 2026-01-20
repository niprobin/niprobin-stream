import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Play, Pause, Download, Maximize2, Heart, X, Star, Loader2 } from 'lucide-react'
import { downloadTrack, likeTrack, rateAlbum } from '@/services/api'
import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'

const PLAYLISTS = [
  'Afrobeat & Highlife',
  'Beats',
  'Bossa Nova',
  'Brazilian Music',
  'Disco Dancefloor',
  'DNB',
  'Downtempo Trip-hop',
  'Funk & Rock',
  'Hip-hop',
  'House Chill',
  'House Dancefloor',
  'Jazz Classic',
  'Jazz Funk',
  'Latin Music',
  'Morning Chill',
  'Neo Soul',
  'Reggae',
  'RNB Mood',
  'Soul Oldies',
] as const

type LikeModalTrack = {
  id: string
  title: string
  artist: string
  spotifyId?: string
}

export function Player() {
  const { currentTrack, isPlaying, pause, resume, currentTime, duration, seek, albumTracks, albumInfo, albumAutoExpand } = useAudio()
  const { isAuthenticated } = useAuth()
  const { showNotification } = useNotification()
  const { increment, decrement, isLoading: isGlobalLoading } = useLoading()
  const { playTrack, loadingTrackId, loadingState } = useTrackPlayer()
  const [isExpanded, setIsExpanded] = useState(false)
  const [likedTrackIds, setLikedTrackIds] = useState<string[]>([])
  const [isLikeModalOpen, setIsLikeModalOpen] = useState(false)
  const [likeModalTrack, setLikeModalTrack] = useState<LikeModalTrack | null>(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('')
  const [isSubmittingLike, setIsSubmittingLike] = useState(false)
  const [albumRating, setAlbumRating] = useState(0)
  const playerRef = useRef<HTMLDivElement>(null)

  // Determine if current track is loading
  const isCurrentTrackLoading = loadingState.status !== 'idle' &&
    loadingState.trackId === currentTrack?.id

  // Auto-expand when album context is set
  const hasAlbumContext = albumTracks.length > 0 && albumInfo

  // Automatically expand player when album context is populated
  useEffect(() => {
    if (hasAlbumContext && albumAutoExpand) {
      setIsExpanded(true)
    }
  }, [hasAlbumContext, albumAutoExpand])

  // Handle click outside to collapse player
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't collapse if clicking inside the modal
      const target = event.target as Node
      const isInsideModal = target instanceof Element && target.closest('[role="dialog"]')

      if (isExpanded && playerRef.current && !playerRef.current.contains(target) && !isInsideModal) {
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

  // Prevent scroll propagation when player is maximized (but allow tracklist scrolling)
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const target = event.target as Element
      // Allow scrolling on the tracklist container
      const isTrackList = target.closest('.overflow-y-auto')
      if (!isTrackList) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const player = playerRef.current
    if (isExpanded && player) {
      player.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      if (player) {
        player.removeEventListener('wheel', handleWheel)
      }
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

    increment()

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
      decrement()
    }
  }

  // Handle clicking a track from the album tracklist
  const handlePlayAlbumTrack = async (track: AlbumTrackItem) => {
    if (!albumInfo) return

    playTrack(
      track['track-id'],
      track.track,
      track.artist,
      {
        clearAlbum: false,
        albumName: albumInfo.name,
        coverArt: albumInfo.cover,
      }
    )
  }

  // Toggle expand/collapse
  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const isTrackLiked = (title?: string, artist?: string) => {
    if (!title || !artist) return false
    // Use track+artist combination for more reliable like tracking
    const likeKey = `${title}|${artist}`
    return likedTrackIds.includes(likeKey)
  }

  const openLikeModal = (trackId: string, title: string, artist: string, spotifyId?: string) => {
    if (!isAuthenticated) return
    setSelectedPlaylist(PLAYLISTS[0])
    setLikeModalTrack({ id: trackId, title, artist, spotifyId })
    setIsLikeModalOpen(true)
  }

  const closeLikeModal = () => {
    setIsLikeModalOpen(false)
    setLikeModalTrack(null)
    setSelectedPlaylist('')
    setIsSubmittingLike(false)
  }

  const handleSubmitLike = async (event: FormEvent) => {
    event.preventDefault()
    if (!likeModalTrack || !selectedPlaylist) {
      showNotification('Pick a playlist', 'error')
      return
    }
    setIsSubmittingLike(true)
    try {
      const result = await likeTrack({
        track: likeModalTrack.title,
        artist: likeModalTrack.artist,
        playlist: selectedPlaylist,
        'spotify-id': likeModalTrack.spotifyId || '',
      })
      if (result.status === 'success') {
        const likeKey = `${likeModalTrack.title}|${likeModalTrack.artist}`
        setLikedTrackIds((prev) =>
          prev.includes(likeKey) ? prev : [...prev, likeKey]
        )
        showNotification(result.message, 'success')
        closeLikeModal()
      } else {
        showNotification(result.message, 'error')
      }
    } catch (err) {
      console.error('Failed to like track:', err)
      showNotification('Could not save like', 'error')
    } finally {
      setIsSubmittingLike(false)
    }
  }

  useEffect(() => {
    setAlbumRating(0)
  }, [albumInfo])

  const handleRateAlbum = async (value: number) => {
    if (!albumInfo) {
      return
    }
    setAlbumRating(value)
    try {
      const response = await rateAlbum({
        album: albumInfo.name,
        artist: albumInfo.artist,
        rating: value,
      })
      showNotification(response.message, response.status)
    } catch (err) {
      console.error('Failed to rate album:', err)
      showNotification('Failed to rate album', 'error')
    }
  }

  return (
    <>
      <div ref={playerRef} className={`fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 md:p-6 transition-all duration-300 ${playerHeight} overflow-hidden flex flex-col`}>
      <div className="flex-shrink-0 w-full">
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
                  className="bg-white text-black rounded-full h-12 w-12 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCurrentTrackLoading}
                >
                  {isCurrentTrackLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </Button>
              </div>

              {/* Right: Buttons */}
              <div className="flex justify-end gap-2">
                {isAuthenticated && currentTrack && (
                  <Button
                    onClick={() =>
                      openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId)
                    }
                    size="icon"
                    variant="ghost"
                    className={`text-slate-300 hover:text-red-400 hover:bg-slate-800 ${
                      isTrackLiked(currentTrack.title, currentTrack.artist) ? 'text-red-400' : ''
                    }`}
                    aria-pressed={isTrackLiked(currentTrack.title, currentTrack.artist)}
                  >
                    <Heart
                      className="h-5 w-5"
                      fill={isTrackLiked(currentTrack.title, currentTrack.artist) ? 'currentColor' : 'none'}
                    />
                  </Button>
                )}
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
                  disabled={isGlobalLoading}
                  className="text-white hover:text-white hover:bg-slate-800"
                >
                  <Download className={`h-5 w-5 ${isGlobalLoading ? 'animate-pulse' : ''}`} />
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
                
                {/* Like Button */}
                {isAuthenticated && currentTrack && (
                  <Button
                    onClick={() =>
                      openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId)
                    }
                    size="icon"
                    variant="ghost"
                    className={`text-white hover:text-red-400 hover:bg-slate-800 ${
                      isTrackLiked(currentTrack.title, currentTrack.artist) ? 'text-red-400' : ''
                    }`}
                    aria-pressed={isTrackLiked(currentTrack.title, currentTrack.artist)}
                  >
                    <Heart
                      className="h-5 w-5"
                      fill={isTrackLiked(currentTrack.title, currentTrack.artist) ? 'currentColor' : 'none'}
                    />
                  </Button>
                )}

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
                  className="bg-white rounded-full text-black h-10 w-10 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCurrentTrackLoading}
                >
                  {isCurrentTrackLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-6 w-6" />
                  ) : (
                    <Play className="h-6 w-6" />
                  )}
                </Button>

                {/* Download Button */}
                <Button
                  onClick={handleDownload}
                  size="icon"
                  variant="ghost"
                  disabled={isGlobalLoading}
                  className="text-white hover:text-white hover:bg-slate-800"
                >
                  <Download className={`h-5 w-5 ${isGlobalLoading ? 'animate-pulse' : ''}`} />
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
        <div className="flex-1 overflow-y-auto w-full pt-8">
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
              <div className="flex items-center gap-1 mt-2" role="radiogroup" aria-label="Album rating">
                {[1, 2, 3, 4, 5].map((value) => {
                  const isActive = albumRating >= value
                  return (
                    <Button
                      key={value}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 text-sm ${isActive ? 'text-yellow-300' : 'text-slate-500'} hover:text-yellow-300`}
                      aria-pressed={isActive}
                      aria-label={`${value} star${value === 1 ? '' : 's'}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRateAlbum(value)
                      }}
                    >
                      <Star className="h-4 w-4" fill={isActive ? 'currentColor' : 'none'} />
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Track List */}
          <div className="divide-y divide-slate-800 overflow-y-auto max-h-full">
            {albumTracks.map((track, index) => {
              const trackId = track['track-id'].toString()
              const isCurrentTrack = currentTrack?.id === trackId
              const liked = isTrackLiked(track.track, track.artist)
              return (
                <div
                  key={`${track['track-id']}-${index}`}
                  onClick={() => handlePlayAlbumTrack(track)}
                  className={`flex items-center gap-2 p-2 hover:bg-slate-800 cursor-pointer transition-colors group ${
                    isCurrentTrack ? 'bg-slate-800' : ''
                  }`}
                >
                  {/* Track Number */}
                  <div className={`text-xs font-medium w-6 text-center group-hover:text-white transition-colors ${
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
                  {loadingTrackId === trackId && (
                    <div className="text-slate-400 text-xs">
                      Loading...
                    </div>
                  )}
                  {isCurrentTrack && !loadingTrackId && (
                    <div className="text-white text-xs">
                      {isPlaying ? '▶' : '❚❚'}
                    </div>
                  )}
                  {isAuthenticated && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 text-slate-300 hover:text-red-400 ${
                        liked ? 'text-red-400' : ''
                      }`}
                      onClick={(event) => {
                        event.stopPropagation()
                        openLikeModal(trackId, track.track, track.artist, undefined)
                      }}
                      aria-pressed={liked}
                    >
                      <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>

      {isLikeModalOpen && likeModalTrack && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitLike}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-slate-400 tracking-wide">Add to playlist</p>
                <p className="text-white text-lg font-semibold truncate">{likeModalTrack.title}</p>
                <p className="text-slate-400 text-sm truncate">{likeModalTrack.artist}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white"
                onClick={closeLikeModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {PLAYLISTS.map((playlist) => {
                const isSelected = selectedPlaylist === playlist
                return (
                  <button
                    type="button"
                    key={playlist}
                    onClick={() => setSelectedPlaylist(playlist)}
                    className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-white bg-white/10 text-white'
                        : 'border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {playlist}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-300 hover:text-white"
                onClick={closeLikeModal}
                disabled={isSubmittingLike}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-white text-black hover:bg-white/90"
                disabled={isSubmittingLike || !selectedPlaylist}
              >
                {isSubmittingLike ? 'Saving...' : 'Add'}
              </Button>
            </div>
          </form>
        </div>
      )}

    </>
  )
}
