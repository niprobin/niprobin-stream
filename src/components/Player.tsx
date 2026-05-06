import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { Button } from '@/components/ui/button'
import { Play, Pause, Download, ListMusic, Heart, Loader2, Share2, X, SkipBack, SkipForward, Music, MoreHorizontal } from 'lucide-react'
import { downloadTrack } from '@/services/api'
import { shareTrack } from '@/utils/urlBuilder'
import { ROUTES } from '@/utils/routes'
import { useState, useEffect, useRef } from 'react'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useLikeModal } from '@/hooks/useLikeModal'
import { TrackList } from '@/components/TrackList'

export function Player() {
  const { currentTrack, isPlaying, pause, resume, currentTime, duration, seek, albumTracks, albumInfo, setAutoPlayContext, playNextTrack, playPreviousTrack, currentTrackIndex } = useAudio()
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

  const [isQueueOpen, setIsQueueOpen] = useState(false)
  const [showMobileActions, setShowMobileActions] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState<{ bottom: number; right: number } | null>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const threeDotsRef = useRef<HTMLButtonElement>(null)

  const isCurrentTrackLoading = loadingState.status !== 'idle' && loadingState.trackId === currentTrack?.id
  const hasAlbumContext = albumTracks.length > 0 && albumInfo

  // Close queue when clicking outside on mobile (backdrop handles desktop)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMobileActions &&
          threeDotsRef.current && !threeDotsRef.current.contains(event.target as Node) &&
          (!popoverRef.current || !popoverRef.current.contains(event.target as Node))) {
        setShowMobileActions(false)
      }
    }
    if (showMobileActions) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMobileActions])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handlePlayPause = () => isPlaying ? pause() : resume()

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seek((e.clientX - rect.left) / rect.width * duration)
  }

  const handleDownload = async () => {
    if (!currentTrack) return
    increment()
    try {
      const blob = await downloadTrack(currentTrack.deezer_id || '0', currentTrack.title, currentTrack.artist)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentTrack.artist} - ${currentTrack.title}.mp3`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      decrement()
    }
  }

  const handleAlbumClick = () => {
    if (!currentTrack?.albumId) return
    window.history.pushState({}, '', ROUTES.album(currentTrack.albumId))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleShareStream = () => {
    if (!currentTrack?.deezer_id) {
      showNotification('Cannot share this track - Deezer ID not available', 'error')
      return
    }
    shareTrack(currentTrack.deezer_id, showNotification)
  }

  const handlePlayAlbumTrack = async (track: AlbumTrackItem, trackIndex: number) => {
    if (!albumInfo) return
    setAutoPlayContext(albumTracks, trackIndex, albumInfo.name)
    playTrack(track.track, track.artist, {
      clearAlbum: false,
      albumName: albumInfo.name,
      coverArt: albumInfo.cover,
      deezer_id: track.deezer_id || '0',
    })
  }

  const handleLikeTrack = (_track: AlbumTrackItem) => {}

  const canGoToPrevious = albumTracks.length > 0 && albumInfo && currentTrackIndex > 0
  const canGoToNext = albumTracks.length > 0 && albumInfo && currentTrackIndex < albumTracks.length - 1

  const queueTitle = albumInfo?.artist === 'Auto-play' ? 'Queue' : (albumInfo?.name ?? 'Queue')
  const queueSubtitle = albumInfo?.artist === 'Auto-play' ? 'Upcoming tracks' : (albumInfo?.artist ?? '')

  return (
    <>
      {/* ── Player bar ───────────────────────────────────────────── */}
      <div
        ref={playerRef}
        className="fixed bottom-0 left-0 right-0 bg-slate-900 p-4 z-[55]"
      >
        {/* Progress bar at top edge */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 cursor-pointer"
          onClick={handleProgressClick}
        >
          <div className="h-full bg-white/70 transition-none" style={{ width: `${progress}%` }} />
        </div>

        {currentTrack ? (
          <>
            {/* Desktop: 3-column layout */}
            <div className="hidden md:grid md:grid-cols-3 items-center gap-4">
              {/* Left: cover + info */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 ${currentTrack.albumId ? 'cursor-pointer' : ''}`}
                  onClick={currentTrack.albumId ? handleAlbumClick : undefined}
                  title={currentTrack.albumId ? currentTrack.album : undefined}
                >
                  {currentTrack.coverArt ? (
                    <img
                      src={currentTrack.coverArt}
                      alt={`${currentTrack.title} cover`}
                      className={`w-10 h-10 rounded-sm object-cover bg-slate-800 ${currentTrack.albumId ? 'hover:opacity-80 transition-opacity' : ''}`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const next = e.currentTarget.nextElementSibling as HTMLElement
                        if (next) next.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div className={`w-10 h-10 rounded-sm bg-slate-800 flex items-center justify-center ${currentTrack.coverArt ? 'hidden' : 'flex'}`}>
                    <Music className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{currentTrack.title}</div>
                  <div className="text-xs text-slate-400 truncate">{currentTrack.artist}</div>
                </div>
              </div>

              {/* Center: prev / play / next */}
              <div className="flex justify-center items-center gap-2">
                <Button onClick={() => playPreviousTrack()} size="icon" variant="ghost"
                  className="text-white/70 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                  disabled={!canGoToPrevious}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button onClick={handlePlayPause} size="icon" variant="ghost"
                  className="bg-white text-black rounded-full h-9 w-9 disabled:opacity-50"
                  disabled={isCurrentTrackLoading}>
                  {isCurrentTrackLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : isPlaying ? <Pause className="h-3.5 w-3.5" />
                    : <Play className="h-3.5 w-3.5" />}
                </Button>
                <Button onClick={() => playNextTrack()} size="icon" variant="ghost"
                  className="text-white/70 hover:text-white hover:bg-slate-800 disabled:opacity-30"
                  disabled={!canGoToNext}>
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              {/* Right: actions + queue */}
              <div className="flex justify-end items-center gap-3">
                <div className="flex gap-1 px-2 py-1 rounded-lg bg-slate-800/30">
                  {isAuthenticated && currentTrack && (
                    <Button
                      onClick={() => openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId, currentTrack.deezer_id)}
                      size="icon" variant="ghost"
                      className={`hover:text-red-400 hover:bg-slate-800 ${isTrackLiked(currentTrack.title, currentTrack.artist) ? 'text-red-400' : 'text-slate-300'}`}
                      aria-pressed={isTrackLiked(currentTrack.title, currentTrack.artist)}
                    >
                      <Heart className="h-4 w-4" fill={isTrackLiked(currentTrack.title, currentTrack.artist) ? 'currentColor' : 'none'} />
                    </Button>
                  )}
                  <Button onClick={handleShareStream} size="icon" variant="ghost"
                    className="text-white hover:text-blue-400 hover:bg-slate-800" title="Share track">
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleDownload} size="icon" variant="ghost"
                    disabled={isGlobalLoading} className="text-white hover:bg-slate-800">
                    <Download className={`h-4 w-4 ${isGlobalLoading ? 'animate-pulse' : ''}`} />
                  </Button>
                </div>
                {hasAlbumContext && (
                  <Button
                    onClick={() => setIsQueueOpen(!isQueueOpen)}
                    size="icon" variant="ghost"
                    className={`hover:text-white hover:bg-slate-800 ${isQueueOpen ? 'text-white bg-slate-800' : 'text-white/70'}`}
                    title="Queue"
                  >
                    <ListMusic className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Mobile layout */}
            <div className="md:hidden">
              <div className="flex items-center gap-3">
                {/* Cover */}
                <div
                  className={`flex-shrink-0 ${currentTrack.albumId ? 'cursor-pointer' : ''}`}
                  onClick={currentTrack.albumId ? handleAlbumClick : undefined}
                >
                  {currentTrack.coverArt ? (
                    <img
                      src={currentTrack.coverArt}
                      alt={`${currentTrack.title} cover`}
                      className={`w-12 h-12 rounded-sm object-cover bg-slate-800 ${currentTrack.albumId ? 'active:opacity-70' : ''}`}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const next = e.currentTarget.nextElementSibling as HTMLElement
                        if (next) next.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div className={`w-12 h-12 rounded-sm bg-slate-800 flex items-center justify-center ${currentTrack.coverArt ? 'hidden' : 'flex'}`}>
                    <Music className="h-4 w-4 text-slate-400" />
                  </div>
                </div>

                {/* Track info + three-dots */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate text-sm">{currentTrack.title}</div>
                      <div className="text-sm text-slate-400 truncate">{currentTrack.artist}</div>
                    </div>
                    <div className="flex-shrink-0">
                      <Button
                        ref={threeDotsRef}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!showMobileActions && threeDotsRef.current) {
                            const rect = threeDotsRef.current.getBoundingClientRect()
                            setPopoverPosition({
                              bottom: window.innerHeight - rect.top + 8,
                              right: window.innerWidth - rect.right,
                            })
                          }
                          setShowMobileActions(!showMobileActions)
                        }}
                        size="icon-sm" variant="ghost"
                        className="text-slate-400 hover:text-white hover:bg-slate-800/50"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Play/Pause */}
                <div className="flex-shrink-0">
                  <Button onClick={handlePlayPause} size="icon-lg" variant="ghost"
                    className="bg-white rounded-full text-black disabled:opacity-50"
                    disabled={isCurrentTrackLoading}>
                    {isCurrentTrackLoading ? <Loader2 className="h-4 w-4 animate-spin" />
                      : isPlaying ? <Pause className="h-4 w-4" />
                      : <Play className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-slate-400 text-sm">No track playing</span>
            {hasAlbumContext && (
              <Button onClick={() => setIsQueueOpen(!isQueueOpen)} size="icon" variant="ghost"
                className="text-white/70 hover:text-white hover:bg-slate-800">
                <ListMusic className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Mobile actions popover ─────────────────────────────────── */}
      {showMobileActions && popoverPosition && (
        <div
          ref={popoverRef}
          style={{ bottom: popoverPosition.bottom, right: popoverPosition.right }}
          className="fixed z-[9999] md:hidden flex items-center gap-0.5 bg-slate-800 border border-slate-700 rounded-xl px-1.5 py-1.5 shadow-2xl"
        >
          {isAuthenticated && currentTrack && (
            <Button
              onClick={() => { openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId, currentTrack.deezer_id); setShowMobileActions(false) }}
              size="icon" variant="ghost"
              className={`text-white hover:text-red-400 hover:bg-slate-700 ${isTrackLiked(currentTrack.title, currentTrack.artist) ? 'text-red-400' : ''}`}
            >
              <Heart className="h-4 w-4" fill={isTrackLiked(currentTrack.title, currentTrack.artist) ? 'currentColor' : 'none'} />
            </Button>
          )}
          <Button onClick={() => { handleShareStream(); setShowMobileActions(false) }}
            size="icon" variant="ghost" className="text-white hover:text-blue-400 hover:bg-slate-700">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button onClick={() => { handleDownload(); setShowMobileActions(false) }}
            size="icon" variant="ghost" disabled={isGlobalLoading} className="text-white hover:bg-slate-700">
            <Download className={`h-4 w-4 ${isGlobalLoading ? 'animate-pulse' : ''}`} />
          </Button>
          {hasAlbumContext && (
            <Button
              onClick={() => { setIsQueueOpen(true); setShowMobileActions(false) }}
              size="icon" variant="ghost"
              className={`text-white hover:bg-slate-700 ${isQueueOpen ? 'text-white' : 'text-slate-300'}`}
            >
              <ListMusic className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* ── Queue drawer ───────────────────────────────────────────── */}
      {/* Mobile backdrop */}
      {isQueueOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsQueueOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div className={`
        fixed z-50 flex flex-col bg-slate-950 border-slate-800 shadow-2xl
        transition-transform duration-300 ease-in-out
        bottom-20 left-0 right-0 top-[40%] rounded-t-2xl border-t
        md:top-0 md:left-auto md:right-0 md:w-80 md:rounded-none md:border-t-0 md:border-l
        ${isQueueOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-white font-semibold text-sm truncate">{queueTitle}</h3>
            <p className="text-xs text-slate-400 truncate">{queueSubtitle}</p>
          </div>
          <Button onClick={() => setIsQueueOpen(false)} size="icon" variant="ghost"
            className="text-slate-400 hover:text-white flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tracklist */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TrackList
            variant="album"
            tracks={albumTracks}
            onSelect={handlePlayAlbumTrack}
            enableLikeButtons={isAuthenticated}
            onLikeTrack={handleLikeTrack}
            currentTrackId={currentTrack?.id}
            loadingTrackId={loadingTrackId}
            isAuthenticated={isAuthenticated}
            compactSpacing={true}
            showColumnHeaders={false}
          />
        </div>
      </div>

      {/* ── Like modal ─────────────────────────────────────────────── */}
      {isLikeModalOpen && likeModalTrack && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] px-4"
          role="dialog" aria-modal="true">
          <form onSubmit={handleSubmitLike}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-slate-400 tracking-wide">Add to playlist</p>
                <p className="text-white text-lg font-semibold truncate">{likeModalTrack.title}</p>
                <p className="text-slate-400 text-sm truncate">{likeModalTrack.artist}</p>
              </div>
              <Button type="button" variant="ghost" size="icon"
                className="text-slate-400 hover:text-white" onClick={closeLikeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {PLAYLISTS.map((playlist) => (
                <button type="button" key={playlist} onClick={() => setSelectedPlaylist(playlist)}
                  className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                    selectedPlaylist === playlist
                      ? 'border-white bg-white/10 text-white'
                      : 'border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}>
                  {playlist}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" className="text-slate-300 hover:text-white"
                onClick={closeLikeModal} disabled={isSubmittingLike}>
                Cancel
              </Button>
              <Button type="submit" className="bg-white text-black hover:bg-white/90"
                disabled={isSubmittingLike || !selectedPlaylist}>
                {isSubmittingLike ? 'Saving...' : 'Add'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
