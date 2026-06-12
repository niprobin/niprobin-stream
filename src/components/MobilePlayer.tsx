import { useRef, useEffect, useState } from 'react'
import {
  ChevronDown, Heart, Share2, Download, ListMusic,
  Play, Pause, SkipBack, SkipForward, Music, Loader2, X, MoreHorizontal,
} from 'lucide-react'
import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useLikeModal } from '@/hooks/useLikeModal'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { usePlayerGestures } from '@/hooks/usePlayerGestures'
import { shareTrack } from '@/utils/urlBuilder'
import { downloadTrack } from '@/services/api'
import { TrackList } from '@/components/TrackList'
import { Button } from '@/components/ui/button'

interface MobilePlayerProps {
  isOpen: boolean
  onClose: () => void
  isAuthenticated: boolean
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function MobilePlayer({ isOpen, onClose, isAuthenticated }: MobilePlayerProps) {
  const {
    currentTrack, isPlaying, currentTime, duration,
    pause, resume, seek, playNextTrack, playPreviousTrack,
    currentTrackIndex, albumTracks, albumInfo, loadingState,
    setAutoPlayContext,
  } = useAudio()
  const { token } = useAuth()
  const { showNotification } = useNotification()
  const { increment, decrement, isLoading: isGlobalLoading } = useLoading()
  const { playTrack, loadingTrackId } = useTrackPlayer()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showQueue, setShowQueue] = useState(false)

  const {
    isLikeModalOpen, likeModalTrack, selectedPlaylist, isSubmittingLike, PLAYLISTS,
    isTrackLiked, openLikeModal, closeLikeModal, handleSubmitLike, setSelectedPlaylist,
  } = useLikeModal(token)

  const canGoToPrevious = albumTracks.length > 0 && !!albumInfo && currentTrackIndex > 0
  const canGoToNext = albumTracks.length > 0 && !!albumInfo && currentTrackIndex < albumTracks.length - 1
  const isCurrentTrackLoading = loadingState.status !== 'idle' && loadingState.trackId === currentTrack?.id
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const hasQueue = albumTracks.length > 0 && !!albumInfo
  const queueTitle = albumInfo?.artist === 'Auto-play' ? 'Queue' : (albumInfo?.name ?? 'Queue')

  usePlayerGestures(containerRef as React.RefObject<HTMLElement>, {
    onSwipeUp:   () => { if (!showQueue && hasQueue) setShowQueue(true) },
    onSwipeDown: () => { if (showQueue) setShowQueue(false); else onClose() },
    onSwipeLeft:  () => { if (!showQueue && canGoToNext) playNextTrack() },
    onSwipeRight: () => { if (!showQueue && canGoToPrevious) playPreviousTrack() },
  })

  useEffect(() => {
    if (isOpen) navigator.vibrate?.(30)
  }, [isOpen])

  // Close queue when player closes
  useEffect(() => {
    if (!isOpen) setShowQueue(false)
  }, [isOpen])

  const handlePlayPause = () => (isPlaying ? pause() : resume())

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek((Number(e.target.value) / 100) * duration)
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

  const handleShare = () => {
    if (!currentTrack?.deezer_id) {
      showNotification('Cannot share this track — Deezer ID not available', 'error')
      return
    }
    shareTrack(currentTrack.deezer_id, showNotification)
  }

  const queueTracks = albumTracks.slice(currentTrackIndex)

  const handlePlayQueueTrack = async (track: AlbumTrackItem, trackIndex: number) => {
    if (!albumInfo) return
    setAutoPlayContext(albumTracks, currentTrackIndex + trackIndex, albumInfo.name)
    playTrack(track.track, track.artist, {
      clearAlbum: false,
      albumName: albumInfo.name,
      coverArt: albumInfo.cover,
      deezer_id: track.deezer_id || '0',
    })
  }

  const handleLikeQueueTrack = (_track: AlbumTrackItem) => {}

  return (
    <>
      {/* Full-screen player — fixed, no scroll */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
        style={{ background: 'linear-gradient(to top, #000000, #152331)', display: isOpen ? 'flex' : 'none' }}
        role="dialog"
        aria-modal="true"
        aria-label="Full player"
      >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 pb-3"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 rounded-full text-white/70 hover:text-white active:bg-white/20 transition-colors"
            aria-label="Close player"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
          <span className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.22em]">Now Playing</span>
          <button
            type="button"
            className="flex items-center justify-center w-11 h-11 rounded-full text-white/70 hover:text-white active:bg-white/20 transition-colors"
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        {/* Body — album art grows to fill space, controls pinned at bottom */}
        <div className="flex-1 flex flex-col px-6 min-h-0 overflow-hidden">
          {/* Album art — fills remaining space, capped at 280px */}
          <div className="flex-1 flex items-center justify-center min-h-0 py-2">
            {currentTrack?.coverArt ? (
              <img
                src={currentTrack.coverArt}
                alt={currentTrack.title}
                className="object-cover"
                style={{
                  width: 'min(312px, 80vw, 45vh)',
                  height: 'min(312px, 80vw, 45vh)',
                  borderRadius: '20px',
                  boxShadow: '0 28px 55px rgba(0,0,0,0.55), inset 0 0 0 0.5px rgba(255,255,255,0.08)',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const sib = e.currentTarget.nextElementSibling as HTMLElement
                  if (sib) sib.style.removeProperty('display')
                }}
              />
            ) : null}
            <div
              className={`items-center justify-center ${currentTrack?.coverArt ? 'hidden' : 'flex'}`}
              style={{
                width: 'min(312px, 80vw, 45vh)',
                height: 'min(312px, 80vw, 45vh)',
                borderRadius: '20px',
                boxShadow: '0 28px 55px rgba(0,0,0,0.55)',
                background: 'linear-gradient(135deg, #6c63d9, #2e9e7a)',
              }}
            >
              <Music className="h-16 w-16 text-white/25" />
            </div>
          </div>

          {/* Controls — always at bottom, never pushed off screen */}
          <div
            className="flex-shrink-0 flex flex-col gap-4"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
            {/* Track info */}
            <div className="flex flex-col gap-1">
              <div className="text-[26px] font-bold text-white leading-snug tracking-tight line-clamp-2">
                {currentTrack?.title ?? '—'}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] text-white/55 truncate flex-1">
                  {currentTrack?.artist ?? ''}
                </span>
                {currentTrack && (
                  <button
                    type="button"
                    onClick={() => isAuthenticated
                      ? openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId, currentTrack.deezer_id)
                      : undefined
                    }
                    className={`flex-shrink-0 transition-opacity active:scale-90 ${
                      !isAuthenticated ? 'opacity-30 pointer-events-none' : ''
                    }`}
                    aria-label="Like track"
                  >
                    <Heart
                      className="h-6 w-6"
                      style={{ color: isTrackLiked(currentTrack.title, currentTrack.artist) ? '#e8743c' : 'rgba(255,255,255,0.65)' }}
                      fill={isTrackLiked(currentTrack.title, currentTrack.artist) ? '#e8743c' : 'none'}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progress}
                onChange={handleSeek}
                className="w-full h-1 rounded-full cursor-pointer appearance-none"
                style={{
                  background: `linear-gradient(to right, #e8743c ${progress}%, rgba(255,255,255,0.16) ${progress}%)`,
                  accentColor: '#e8743c',
                }}
                aria-label="Playback progress"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[12px] text-white/45 tabular-nums">{formatTime(currentTime)}</span>
                <span className="text-[12px] text-white/45 tabular-nums">-{formatTime(Math.max(0, duration - currentTime))}</span>
              </div>
            </div>

            {/* Main controls */}
            <div className="flex items-center justify-center gap-[52px]">
              <button
                type="button"
                onClick={() => { if (canGoToPrevious) playPreviousTrack() }}
                disabled={!canGoToPrevious}
                className="text-white disabled:opacity-25 active:scale-90 transition-transform"
                aria-label="Previous track"
              >
                <SkipBack className="h-7 w-7" />
              </button>
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={isCurrentTrackLoading}
                className="flex items-center justify-center w-[74px] h-[74px] rounded-full bg-white text-black disabled:opacity-50 active:scale-95 transition-transform"
                style={{ boxShadow: '0 10px 26px rgba(0,0,0,0.4)' }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isCurrentTrackLoading
                  ? <Loader2 className="h-7 w-7 animate-spin" />
                  : isPlaying
                  ? <Pause className="h-7 w-7" />
                  : <Play className="h-7 w-7" />}
              </button>
              <button
                type="button"
                onClick={() => { if (canGoToNext) playNextTrack() }}
                disabled={!canGoToNext}
                className="text-white disabled:opacity-25 active:scale-90 transition-transform"
                aria-label="Next track"
              >
                <SkipForward className="h-7 w-7" />
              </button>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => currentTrack && isAuthenticated
                  ? openLikeModal(currentTrack.id, currentTrack.title, currentTrack.artist, currentTrack.spotifyId, currentTrack.deezer_id)
                  : undefined
                }
                className={`flex flex-col items-center gap-1.5 py-2 justify-center transition-opacity active:opacity-50 ${
                  !isAuthenticated || !currentTrack ? 'opacity-30 pointer-events-none' : ''
                }`}
                aria-label="Like track"
              >
                <Heart
                  className="h-[22px] w-[22px]"
                  style={{ color: currentTrack && isTrackLiked(currentTrack.title, currentTrack.artist) ? '#e8743c' : 'rgba(255,255,255,0.65)' }}
                  fill={currentTrack && isTrackLiked(currentTrack.title, currentTrack.artist) ? '#e8743c' : 'none'}
                />
                <span className="text-[11.5px] text-white/55">Like</span>
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex flex-col items-center gap-1.5 py-2 justify-center text-white/65 active:opacity-50 transition-opacity"
                aria-label="Share track"
              >
                <Share2 className="h-[22px] w-[22px]" />
                <span className="text-[11.5px] text-white/55">Share</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={isGlobalLoading}
                className="flex flex-col items-center gap-1.5 py-2 justify-center text-white/65 disabled:opacity-30 active:opacity-50 transition-opacity"
                aria-label="Download track"
              >
                <Download className={`h-[22px] w-[22px] ${isGlobalLoading ? 'animate-pulse' : ''}`} />
                <span className="text-[11.5px] text-white/55">Download</span>
              </button>
              <button
                type="button"
                onClick={() => hasQueue ? setShowQueue(true) : undefined}
                className={`flex flex-col items-center gap-1.5 py-2 justify-center transition-opacity active:opacity-50 ${
                  !hasQueue ? 'opacity-30 pointer-events-none' : 'text-white/65'
                }`}
                aria-label="View queue"
              >
                <ListMusic className="h-[22px] w-[22px]" />
                <span className="text-[11.5px] text-white/55">Queue</span>
              </button>
            </div>
          </div>
        </div>

        {/* Queue panel — slides over the player */}
        {showQueue && (
          <div className="absolute inset-0 z-10 flex flex-col bg-slate-950">
            <div
              className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-800"
              style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 16px)' }}
            >
              <div className="min-w-0">
                <h3 className="text-white font-semibold text-sm truncate">{queueTitle}</h3>
                <p className="text-xs text-slate-400 truncate">
                  {albumInfo?.artist === 'Auto-play' ? 'Upcoming tracks' : (albumInfo?.artist ?? '')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQueue(false)}
                className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close queue"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto"
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <TrackList
                variant="album"
                tracks={queueTracks}
                onSelect={handlePlayQueueTrack}
                enableLikeButtons={isAuthenticated}
                onLikeTrack={handleLikeQueueTrack}
                currentTrackId={currentTrack?.id}
                loadingTrackId={loadingTrackId}
                isAuthenticated={isAuthenticated}
                compactSpacing={true}
                showColumnHeaders={false}
              />
            </div>
          </div>
        )}
      </div>

      {/* Like modal — rendered above the player */}
      {isLikeModalOpen && likeModalTrack && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] px-4"
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
              <Button type="button" variant="ghost" size="icon"
                className="text-slate-400 hover:text-white flex-shrink-0" onClick={closeLikeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {PLAYLISTS.map((playlist) => (
                <button
                  type="button"
                  key={playlist}
                  onClick={() => setSelectedPlaylist(playlist)}
                  className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                    selectedPlaylist === playlist
                      ? 'border-white bg-white/10 text-white'
                      : 'border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
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
