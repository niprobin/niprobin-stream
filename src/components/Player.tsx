import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { Button } from '@/components/ui/button'
import { Play, Pause, Download, ListMusic, Heart, Loader2, Share2, X, SkipBack, SkipForward } from 'lucide-react'
import { CoverArtPlaceholder } from '@/components/ui/CoverArtPlaceholder'
import { downloadTrack } from '@/services/api'
import { shareTrack } from '@/utils/urlBuilder'
import { ROUTES } from '@/utils/routes'
import { useState, useRef } from 'react'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useLikeModal } from '@/hooks/useLikeModal'
import { TrackList } from '@/components/TrackList'

export function Player() {
  const { currentTrack, isPlaying, pause, resume, currentTime, duration, seek, albumTracks, albumInfo, setAutoPlayContext, playNextTrack, playPreviousTrack, currentTrackIndex, isNavInFlight } = useAudio()
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
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const isCurrentTrackLoading = loadingState.status !== 'idle' && loadingState.trackId === currentTrack?.id
  const hasAlbumContext = albumTracks.length > 0 && albumInfo

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handlePlayPause = () => isPlaying ? pause() : resume()

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seek((e.clientX - rect.left) / rect.width * duration)
    setIsDraggingProgress(true)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!progressRef.current) return
      const moveRect = progressRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (moveEvent.clientX - moveRect.left) / moveRect.width))
      seek(pct * duration)
    }

    const handleMouseUp = () => {
      setIsDraggingProgress(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const touch = e.touches[0]
    seek((touch.clientX - rect.left) / rect.width * duration)
    setIsDraggingProgress(true)

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!progressRef.current) return
      const moveRect = progressRef.current.getBoundingClientRect()
      const moveTouch = moveEvent.touches[0]
      const pct = Math.max(0, Math.min(1, (moveTouch.clientX - moveRect.left) / moveRect.width))
      seek(pct * duration)
    }

    const handleTouchEnd = () => {
      setIsDraggingProgress(false)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }

    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
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

  const handlePlayAlbumTrack = async (track: AlbumTrackItem, slicedIndex: number) => {
    if (!albumInfo) return
    const absoluteIndex = currentTrackIndex + slicedIndex
    setAutoPlayContext(albumTracks, absoluteIndex, albumInfo.name)
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
      {/* ── Player bar (desktop docked, in-flow at bottom of main column) ── */}
      <div
        ref={playerRef}
        className="relative bg-bg-1 border-t border-border px-6 py-3"
      >
        {/* Progress bar at top edge — oversized touch target, thin visual track */}
        <div
          ref={progressRef}
          className="absolute top-0 left-0 right-0 h-3 cursor-pointer group/progress touch-none"
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 group-hover/progress:h-2 bg-border transition-all duration-100">
            <div className="h-full bg-accent transition-none" style={{ width: `${progress}%` }} />
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-md pointer-events-none transition-opacity duration-100 ${
                isDraggingProgress ? 'opacity-100' : 'opacity-0 group-hover/progress:opacity-100'
              }`}
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        {currentTrack ? (
          <div className="grid grid-cols-3 items-center gap-4">
            {/* Left: cover + info */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex-shrink-0 ${currentTrack.albumId ? 'cursor-pointer' : ''}`}
                onClick={currentTrack.albumId ? handleAlbumClick : undefined}
                title={currentTrack.albumId ? currentTrack.album : undefined}
              >
                {currentTrack.coverArt ? (
                  <img
                    src={currentTrack.coverArt}
                    alt={`${currentTrack.title} cover`}
                    className={`w-11 h-11 rounded-[10px] object-cover bg-bg-2 ${currentTrack.albumId ? 'hover:opacity-80 transition-opacity' : ''}`}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      const next = e.currentTarget.nextElementSibling as HTMLElement
                      if (next) next.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className={currentTrack.coverArt ? 'hidden' : 'block'}>
                  <CoverArtPlaceholder size={44} radius={10} showLabel={false} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text-1 truncate">{currentTrack.title}</div>
                <div className="text-xs text-text-2 truncate">{currentTrack.artist}</div>
              </div>
            </div>

            {/* Center: prev / play / next */}
            <div className="flex justify-center items-center gap-3">
              <Button onClick={() => playPreviousTrack()} size="icon" variant="ghost"
                className="text-text-2 hover:text-text-1 hover:bg-bg-2 disabled:opacity-30"
                disabled={!canGoToPrevious || isNavInFlight}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button onClick={handlePlayPause} size="icon" variant="ghost"
                className="bg-accent text-accent-ink hover:bg-accent/90 rounded-full h-10 w-10 disabled:opacity-50"
                disabled={isCurrentTrackLoading}>
                {isCurrentTrackLoading ? <Loader2 className="h-4 w-4 animate-spin" />
                  : isPlaying ? <Pause className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                  : <Play className="h-4 w-4" fill="currentColor" strokeWidth={0} />}
              </Button>
              <Button onClick={() => playNextTrack()} size="icon" variant="ghost"
                className="text-text-2 hover:text-text-1 hover:bg-bg-2 disabled:opacity-30"
                disabled={!canGoToNext || isNavInFlight}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Right: actions + queue */}
            <div className="flex justify-end items-center gap-3">
              <div className="flex gap-1 px-2 py-1 rounded-sm-crate bg-bg-2/40">
                {isAuthenticated && currentTrack && (
                  <Button
                    onClick={() => openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId, currentTrack.deezer_id)}
                    size="icon" variant="ghost"
                    className={`hover:text-accent hover:bg-bg-2 ${isTrackLiked(currentTrack.title, currentTrack.artist) ? 'text-accent' : 'text-text-2'}`}
                    aria-pressed={isTrackLiked(currentTrack.title, currentTrack.artist)}
                  >
                    <Heart className="h-4 w-4" fill={isTrackLiked(currentTrack.title, currentTrack.artist) ? 'currentColor' : 'none'} />
                  </Button>
                )}
                <Button onClick={handleShareStream} size="icon" variant="ghost"
                  className="text-text-2 hover:text-accent hover:bg-bg-2" title="Share track">
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button onClick={handleDownload} size="icon" variant="ghost"
                  disabled={isGlobalLoading} className="text-text-2 hover:text-text-1 hover:bg-bg-2">
                  <Download className={`h-4 w-4 ${isGlobalLoading ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
              {hasAlbumContext && (
                <Button
                  onClick={() => setIsQueueOpen(!isQueueOpen)}
                  size="icon" variant="ghost"
                  className={`hover:text-text-1 hover:bg-bg-2 ${isQueueOpen ? 'text-text-1 bg-bg-2' : 'text-text-2'}`}
                  title="Queue"
                >
                  <ListMusic className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2">
            <span className="text-text-2 text-sm">Nothing playing</span>
            {hasAlbumContext && (
              <Button onClick={() => setIsQueueOpen(!isQueueOpen)} size="icon" variant="ghost"
                className="text-text-2 hover:text-text-1 hover:bg-bg-2">
                <ListMusic className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

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
        fixed z-50 flex flex-col bg-bg-0-deep border-border shadow-2xl
        transition-transform duration-300 ease-in-out
        bottom-20 left-0 right-0 top-[40%] rounded-t-2xl border-t
        md:top-0 md:left-auto md:right-0 md:w-80 md:rounded-none md:border-t-0 md:border-l
        ${isQueueOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="min-w-0">
            <h3 className="text-text-1 font-semibold text-sm truncate">{queueTitle}</h3>
            <p className="text-xs text-text-2 truncate">{queueSubtitle}</p>
          </div>
          <Button onClick={() => setIsQueueOpen(false)} size="icon" variant="ghost"
            className="text-text-2 hover:text-text-1 flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tracklist */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TrackList
            variant="album"
            tracks={albumTracks.slice(currentTrackIndex)}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] px-4"
          role="dialog" aria-modal="true">
          <form onSubmit={handleSubmitLike}
            className="w-full md:max-w-sm h-[90vh] max-h-[720px] flex flex-col bg-bg-1 border border-border rounded-lg-crate p-5 space-y-4 shadow-2xl md:h-auto md:max-h-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-text-3 tracking-wide font-mono-label">Add to playlist</p>
                <p className="text-text-1 text-lg font-semibold truncate">{likeModalTrack.title}</p>
                <p className="text-text-2 text-sm truncate">{likeModalTrack.artist}</p>
              </div>
              <Button type="button" variant="ghost" size="icon"
                className="text-text-2 hover:text-text-1" onClick={closeLikeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
              {PLAYLISTS.map((playlist) => (
                <button type="button" key={playlist} onClick={() => setSelectedPlaylist(playlist)}
                  className={`text-left text-sm px-3 py-2 rounded-sm-crate border transition-colors ${
                    selectedPlaylist === playlist
                      ? 'border-accent bg-accent/12 text-text-1'
                      : 'border-border text-text-2 hover:border-text-3'
                  }`}>
                  {playlist}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" className="text-text-2 hover:text-text-1"
                onClick={closeLikeModal} disabled={isSubmittingLike}>
                Cancel
              </Button>
              <Button type="submit" className="bg-accent text-accent-ink hover:bg-accent/90"
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
