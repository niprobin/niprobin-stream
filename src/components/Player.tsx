import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Play, Pause, Download, Maximize2, Heart, Loader2, Share2, X, SkipBack, SkipForward, Music, MoreHorizontal } from 'lucide-react'
import { downloadTrack } from '@/services/api'
import { shareTrack } from '@/utils/urlBuilder'
import { useState, useEffect, useRef } from 'react'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useLikeModal } from '@/hooks/useLikeModal'
import { TrackList } from '@/components/TrackList'

// PLAYLISTS constant and LikeModalTrack type moved to TrackList component

export function Player() {
  const { currentTrack, isPlaying, pause, resume, currentTime, duration, seek, albumTracks, albumInfo, albumAutoExpand, setAutoPlayContext, playNextTrack, playPreviousTrack, currentTrackIndex } = useAudio()
  const { isAuthenticated, token } = useAuth()
  const { showNotification } = useNotification()
  const { increment, decrement, isLoading: isGlobalLoading } = useLoading()
  const { playTrack, loadingTrackId, loadingState } = useTrackPlayer()
  const {
    isLikeModalOpen,
    likeModalTrack,
    selectedPlaylist,
    isSubmittingLike,
    PLAYLISTS,
    isTrackLiked,
    openLikeModal,
    closeLikeModal,
    handleSubmitLike,
    setSelectedPlaylist,
  } = useLikeModal(token)
  const [isExpanded, setIsExpanded] = useState(false)
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

  // Navigate to album page
  const handleAlbumClick = () => {
    if (!currentTrack?.albumId) return

    const albumUrl = `/album/${currentTrack.albumId}`
    window.history.pushState({}, '', albumUrl)
    // Trigger popstate to handle route change
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  // Share the current track
  const handleShare = () => {
    if (!currentTrack?.hashUrl) {
      showNotification('Cannot share this track', 'error')
      return
    }
    shareTrack(currentTrack.hashUrl, showNotification)
  }

  // Handle clicking a track from the album tracklist
  const handlePlayAlbumTrack = async (track: AlbumTrackItem, trackIndex: number) => {
    if (!albumInfo) return

    // Update the current track index for proper auto-play sequencing
    setAutoPlayContext(albumTracks, trackIndex, albumInfo.name)

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

  // Navigation handlers
  const handlePreviousTrack = () => {
    playPreviousTrack()
  }

  const handleNextTrack = () => {
    playNextTrack()
  }

  // Button state management
  const canGoToPrevious = albumTracks.length > 0 && albumInfo && currentTrackIndex > 0
  const canGoToNext = albumTracks.length > 0 && albumInfo && currentTrackIndex < albumTracks.length - 1

  // isTrackLiked function now comes from useLikeModal hook

  // Like track handler for TrackList component
  const handleLikeTrack = (track: AlbumTrackItem) => {
    // The TrackList component handles the full like flow using useLikeModal hook
    // This handler is called after successful like operations
    console.log('Track liked:', track.track, track.artist)
  }


  return (
    <>
      <div ref={playerRef} className={`fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-4 md:p-6 transition-all duration-300 ${playerHeight} overflow-hidden flex flex-col`}>
      <div className="flex-shrink-0 w-full">
        {currentTrack ? (
          <>
            {/* Desktop Layout: 3 columns */}
            <div className="hidden md:grid md:grid-cols-3 items-center gap-4 mb-4">
                {/* Left: Album Cover and Track Info */}
                <div className="flex items-center gap-3 text-left">
                  {/* Album Cover */}
                  <div className="flex-shrink-0">
                    {currentTrack.coverArt ? (
                      <img
                        src={currentTrack.coverArt}
                        alt={`${currentTrack.title} cover`}
                        className="w-12 h-12 rounded-lg object-cover bg-slate-800"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                          if (nextElement) {
                            nextElement.style.display = 'flex'
                          }
                        }}
                      />
                    ) : null}
                    {/* Fallback when no cover or image fails to load */}
                    <div
                      className={`w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center ${
                        currentTrack.coverArt ? 'hidden' : 'flex'
                      }`}
                    >
                      <Music className="h-6 w-6 text-slate-400" />
                    </div>
                  </div>

                  {/* Track Info */}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{currentTrack.title}</div>
                    <div className="text-sm text-slate-400 truncate">{currentTrack.artist}</div>
                    {currentTrack.album && (
                      currentTrack.albumId ? (
                        <a
                          href={`/album/${currentTrack.albumId}`}
                          className="text-xs text-slate-500 truncate cursor-pointer hover:text-slate-300 transition-colors block"
                          onClick={(e) => {
                            e.preventDefault()
                            handleAlbumClick()
                          }}
                        >
                          {currentTrack.album}
                        </a>
                      ) : (
                        <div className="text-xs text-slate-500 truncate">
                          {currentTrack.album}
                        </div>
                      )
                    )}
                  </div>
                </div>

              {/* Center: Navigation and Play Controls */}
              <div className="flex justify-center items-center gap-2">
                {/* Previous Button */}
                {hasAlbumContext && (
                  <Button
                    onClick={handlePreviousTrack}
                    size="icon"
                    variant="ghost"
                    className="text-white/70 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                    disabled={!canGoToPrevious}
                  >
                    <SkipBack className="h-5 w-5" />
                  </Button>
                )}

                {/* Play/Pause Button */}
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

                {/* Next Button */}
                {hasAlbumContext && (
                  <Button
                    onClick={handleNextTrack}
                    size="icon"
                    variant="ghost"
                    className="text-white/70 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                    disabled={!canGoToNext}
                  >
                    <SkipForward className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {/* Right: Buttons */}
              <div className="flex justify-end items-center gap-3">
                {/* Track Action Buttons - Grouped container */}
                <div className="flex gap-2 px-2 py-1 rounded-lg bg-slate-800/30">
                  {isAuthenticated && currentTrack && (
                    <Button
                      onClick={() => openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId)}
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
                  <Button
                    onClick={handleShare}
                    size="icon"
                    variant="ghost"
                    className="text-white hover:text-blue-400 hover:bg-slate-800"
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
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

                {/* Player Control Button - Separated */}
                {hasAlbumContext && (
                  <Button
                    onClick={toggleExpand}
                    size="icon"
                    variant="ghost"
                    className="text-white/70 hover:text-white hover:bg-slate-800"
                  >
                    <Maximize2 className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile-First Responsive Layout */}
            <div className="md:hidden flex flex-col gap-2 mb-2">

              {/* Track Info with Cover - shared across all mobile sizes */}
              <div className="flex items-center justify-center gap-3 px-4">
                {/* Album Cover */}
                <div className="flex-shrink-0">
                  {currentTrack.coverArt ? (
                    <img
                      src={currentTrack.coverArt}
                      alt={`${currentTrack.title} cover`}
                      className="w-10 h-10 rounded-lg object-cover bg-slate-800"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const nextElement = e.currentTarget.nextElementSibling as HTMLElement
                        if (nextElement) {
                          nextElement.style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  {/* Fallback when no cover or image fails to load */}
                  <div
                    className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center ${
                      currentTrack.coverArt ? 'hidden' : 'flex'
                    }`}
                  >
                    <Music className="h-5 w-5 text-slate-400" />
                  </div>
                </div>

                {/* Track Info */}
                <div className="text-center text-sm max-w-full min-w-0 flex-1">
                  <div className="text-white truncate">
                    <span className="font-semibold">{currentTrack.title}</span>
                    <span className="text-slate-400"> – {currentTrack.artist}</span>
                  </div>
                  {currentTrack.album && (
                    currentTrack.albumId ? (
                      <a
                        href={`/album/${currentTrack.albumId}`}
                        className="text-xs text-slate-500 truncate mt-0.5 cursor-pointer hover:text-slate-300 transition-colors block"
                        onClick={(e) => {
                          e.preventDefault()
                          handleAlbumClick()
                        }}
                      >
                        {currentTrack.album}
                      </a>
                    ) : (
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {currentTrack.album}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Mobile Three-Row Layout (default: 320px-639px) */}

              {/* Row 1: Primary Control - Large Play/Pause Button */}
              <div className="sm:hidden flex justify-center">
                <Button
                  onClick={handlePlayPause}
                  size="icon-lg"
                  variant="ghost"
                  className="bg-white rounded-full text-black h-12 w-12 disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Row 2: Secondary Controls - Navigation & Actions */}
              <div className="sm:hidden flex justify-between items-center px-2">
                {/* Left: Navigation Controls */}
                <div className="flex gap-1">
                  {hasAlbumContext && (
                    <>
                      <Button
                        onClick={handlePreviousTrack}
                        size="icon-sm"
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                        disabled={!canGoToPrevious}
                      >
                        <SkipBack className="h-5 w-5" />
                      </Button>
                      <Button
                        onClick={handleNextTrack}
                        size="icon-sm"
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                        disabled={!canGoToNext}
                      >
                        <SkipForward className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Center: Essential Actions */}
                <div className="flex gap-1">
                  {isAuthenticated && currentTrack && (
                    <Button
                      onClick={() => openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId)}
                      size="icon-sm"
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
                  <Button
                    onClick={handleShare}
                    size="icon-sm"
                    variant="ghost"
                    className="text-white hover:text-blue-400 hover:bg-slate-800"
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
                </div>

                {/* Right: More Menu for Overflow Actions */}
                <div className="relative">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-white/70 hover:text-white hover:bg-slate-800"
                    onClick={(e) => {
                      e.stopPropagation()
                      const menu = e.currentTarget.nextElementSibling as HTMLElement
                      if (menu) {
                        menu.classList.toggle('hidden')
                      }
                    }}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>

                  {/* Dropdown Menu */}
                  <div className="absolute bottom-full right-0 mb-2 bg-slate-900 border border-slate-800 rounded-lg shadow-xl hidden z-10 min-w-[140px]">
                    <Button
                      onClick={() => {
                        handleDownload()
                        // Close menu
                        const menu = document.querySelector('.absolute.bottom-full') as HTMLElement
                        if (menu) menu.classList.add('hidden')
                      }}
                      variant="ghost"
                      disabled={isGlobalLoading}
                      className="w-full justify-start text-white hover:text-white hover:bg-slate-800 rounded-none rounded-t-lg text-sm h-10"
                    >
                      <Download className={`h-4 w-4 mr-2 ${isGlobalLoading ? 'animate-pulse' : ''}`} />
                      Download
                    </Button>
                    {hasAlbumContext && (
                      <Button
                        onClick={() => {
                          toggleExpand()
                          // Close menu
                          const menu = document.querySelector('.absolute.bottom-full') as HTMLElement
                          if (menu) menu.classList.add('hidden')
                        }}
                        variant="ghost"
                        className="w-full justify-start text-white/70 hover:text-white hover:bg-slate-800 rounded-none rounded-b-lg text-sm h-10"
                      >
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Expand Queue
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Small Screen Hybrid Layout (sm: 640px-767px) */}
              <div className="hidden sm:flex md:hidden justify-between items-center">
                {/* Left: Navigation + Play */}
                <div className="flex items-center gap-2">
                  {hasAlbumContext && (
                    <>
                      <Button
                        onClick={handlePreviousTrack}
                        size="icon"
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                        disabled={!canGoToPrevious}
                      >
                        <SkipBack className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={handleNextTrack}
                        size="icon"
                        variant="ghost"
                        className="text-white/70 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                        disabled={!canGoToNext}
                      >
                        <SkipForward className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={handlePlayPause}
                    size="icon"
                    variant="ghost"
                    className="bg-white rounded-full text-black disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isCurrentTrackLoading}
                  >
                    {isCurrentTrackLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>
                </div>

                {/* Right: All Actions */}
                <div className="flex items-center gap-2">
                  {isAuthenticated && currentTrack && (
                    <Button
                      onClick={() => openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId)}
                      size="icon"
                      variant="ghost"
                      className={`text-white hover:text-red-400 hover:bg-slate-800 ${
                        isTrackLiked(currentTrack.title, currentTrack.artist) ? 'text-red-400' : ''
                      }`}
                      aria-pressed={isTrackLiked(currentTrack.title, currentTrack.artist)}
                    >
                      <Heart
                        className="h-4 w-4"
                        fill={isTrackLiked(currentTrack.title, currentTrack.artist) ? 'currentColor' : 'none'}
                      />
                    </Button>
                  )}
                  <Button
                    onClick={handleShare}
                    size="icon"
                    variant="ghost"
                    className="text-white hover:text-blue-400 hover:bg-slate-800"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleDownload}
                    size="icon"
                    variant="ghost"
                    disabled={isGlobalLoading}
                    className="text-white hover:text-white hover:bg-slate-800"
                  >
                    <Download className={`h-4 w-4 ${isGlobalLoading ? 'animate-pulse' : ''}`} />
                  </Button>
                  {hasAlbumContext && (
                    <Button
                      onClick={toggleExpand}
                      size="icon"
                      variant="ghost"
                      className="text-white/70 hover:text-white hover:bg-slate-800"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
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
          {/* Queue Header */}
          <div className="flex flex-col gap-1 px-4 py-5 border-t border-slate-800">
            <h3 className="text-base font-semibold text-white line-clamp-1">
              {albumInfo.artist === "Auto-play" ? "Queue" : albumInfo.name}
            </h3>
            <p className="text-sm text-slate-400">
              {albumInfo.artist === "Auto-play" ? "Upcoming tracks" : albumInfo.artist}
            </p>
          </div>

          {/* Track List */}
          <div className="overflow-y-auto max-h-full">
            <TrackList
              variant="album"
              tracks={albumTracks}
              onSelect={handlePlayAlbumTrack}
              enableLikeButtons={isAuthenticated}
              onLikeTrack={handleLikeTrack}
              currentTrackId={currentTrack?.id}
              isPlaying={isPlaying}
              loadingTrackId={loadingTrackId}
              isAuthenticated={isAuthenticated}
              compactSpacing={true}
              showColumnHeaders={false}
            />
          </div>
        </div>
      )}
    </div>

    {/* Like Modal */}
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
