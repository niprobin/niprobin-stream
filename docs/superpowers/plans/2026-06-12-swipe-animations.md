# Swipe Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time drag-follow animations to MobilePlayer swipe gestures so users can see where each swipe leads before committing.

**Architecture:** Extend `usePlayerGestures` with a `touchmove` path that fires `onDragX`/`onDragY` continuously; `MobilePlayer` maintains `dragX`/`dragY`/`isDragging` state and applies CSS transforms — no transition during drag (zero-lag), spring transition on release. The layout splits into a draggable art layer (art + track title, translates on horizontal drag) and a fixed controls layer (progress bar, play controls, actions — never moves). The queue panel is always rendered and driven by `dragY` instead of conditionally mounted.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, inline CSS transforms

---

## File map

| File | Change |
|---|---|
| `src/hooks/usePlayerGestures.ts` | Add `touchmove` handler with axis-lock; add `onDragX`, `onDragY`, `onDragEnd` to `GestureHandlers` |
| `src/components/MobilePlayer.tsx` | Split layout; add drag state; wire new hook callbacks; render ghost arts; drive queue with `dragY` |

---

### Task 1: Extend `usePlayerGestures` with drag callbacks

**Files:**
- Modify: `src/hooks/usePlayerGestures.ts`

- [ ] **Step 1: Replace the full hook file**

Replace the entire contents of `src/hooks/usePlayerGestures.ts` with:

```typescript
import { useEffect, useRef } from 'react'

interface GestureHandlers {
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onDragX?: (deltaX: number) => void
  onDragY?: (deltaY: number) => void
  onDragEnd?: () => void
}

interface GestureConfig {
  minSwipeDistance?: number
}

export function usePlayerGestures(
  ref: React.RefObject<HTMLElement>,
  handlers: GestureHandlers,
  config: GestureConfig = {}
): void {
  const { minSwipeDistance = 40 } = config
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const axisLock = useRef<'x' | 'y' | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY }
      axisLock.current = null
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStart.current) return
      const touch = e.touches[0]
      const deltaX = touchStart.current.x - touch.clientX
      const deltaY = touchStart.current.y - touch.clientY

      // Lock to dominant axis after 8px of movement
      if (!axisLock.current) {
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
          axisLock.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
        }
        return
      }

      if (axisLock.current === 'x') {
        handlersRef.current.onDragX?.(deltaX)
      } else {
        handlersRef.current.onDragY?.(deltaY)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return
      handlersRef.current.onDragEnd?.()

      const touch = e.changedTouches[0]
      const diffX = touchStart.current.x - touch.clientX
      const diffY = touchStart.current.y - touch.clientY
      const absDiffX = Math.abs(diffX)
      const absDiffY = Math.abs(diffY)
      touchStart.current = null
      axisLock.current = null

      if (absDiffY >= minSwipeDistance && absDiffY > absDiffX) {
        e.preventDefault()
        navigator.vibrate?.(30)
        if (diffY > 0) handlersRef.current.onSwipeUp?.()
        else handlersRef.current.onSwipeDown?.()
      } else if (absDiffX >= minSwipeDistance && absDiffX > absDiffY) {
        e.preventDefault()
        navigator.vibrate?.([30, 50, 30])
        if (diffX > 0) handlersRef.current.onSwipeLeft?.()
        else handlersRef.current.onSwipeRight?.()
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [ref, minSwipeDistance])
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `usePlayerGestures.ts`. (MobilePlayer errors expected since new callbacks aren't wired yet — ignore those for now.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePlayerGestures.ts
git commit -m "feat: add touchmove drag callbacks to usePlayerGestures"
```

---

### Task 2: Refactor MobilePlayer — layout split + drag animations

**Files:**
- Modify: `src/components/MobilePlayer.tsx`

This task applies all MobilePlayer changes at once: drag state, layout split, ghost arts, and queue panel. These changes are tightly coupled and cannot be split further without leaving the component broken mid-task.

- [ ] **Step 1: Replace the full MobilePlayer component**

Replace the entire contents of `src/components/MobilePlayer.tsx` with the following. Read the file first to confirm you understand what you are replacing, then apply this:

```typescript
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

const ART_SIZE = 'min(312px, 80vw, 45vh)'
const SWIPE_THRESHOLD = 40
const SPRING = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

function ArtBox({ coverArt, title, size }: { coverArt?: string; title?: string; size: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showPlaceholder = !coverArt || imgFailed
  return (
    <div style={{ width: size, height: size, borderRadius: '20px', overflow: 'hidden', flexShrink: 0 }}>
      {!showPlaceholder && (
        <img
          src={coverArt}
          alt={title}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
      {showPlaceholder && (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6c63d9, #2e9e7a)' }}
        >
          <Music className="h-16 w-16 text-white/25" />
        </div>
      )}
    </div>
  )
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
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

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
  const prevTrack = albumTracks[currentTrackIndex - 1] ?? null
  const nextTrack = albumTracks[currentTrackIndex + 1] ?? null
  const ghostCover = albumInfo?.cover

  usePlayerGestures(containerRef as React.RefObject<HTMLElement>, {
    onSwipeUp: () => {
      if (!showQueue && hasQueue) {
        setShowQueue(true)
        setDragY(0)
      }
    },
    onSwipeDown: () => {
      if (showQueue) {
        setShowQueue(false)
        setDragY(0)
      } else {
        onClose()
      }
    },
    onSwipeLeft: () => {
      if (!showQueue && canGoToNext) playNextTrack()
    },
    onSwipeRight: () => {
      if (!showQueue && canGoToPrevious) playPreviousTrack()
    },
    onDragX: (deltaX) => {
      if (showQueue) return
      setIsDragging(true)
      setDragX(Math.max(-window.innerWidth, Math.min(window.innerWidth, deltaX)))
    },
    onDragY: (deltaY) => {
      if (showQueue) return
      setIsDragging(true)
      // deltaY positive = finger moving up = queue revealing
      setDragY(Math.max(0, Math.min(window.innerHeight * 0.85, deltaY)))
    },
    onDragEnd: () => {
      setIsDragging(false)
      if (dragY > window.innerHeight * 0.3) {
        setShowQueue(true)
      }
      setDragX(0)
      setDragY(0)
    },
  })

  useEffect(() => {
    if (isOpen) navigator.vibrate?.(30)
  }, [isOpen])

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

  const artTransition = isDragging ? 'none' : SPRING
  const queueTranslateY = showQueue ? '0%' : `calc(100% - ${dragY}px)`
  const queueTransition = isDragging ? 'none' : SPRING

  return (
    <>
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

        {/* Body */}
        <div className="flex-1 flex flex-col min-h-0" style={{ overflow: 'visible' }}>

          {/* Draggable art layer: art strip + track info */}
          <div
            className="flex-1 flex flex-col min-h-0 py-2"
            style={{
              transform: `translateX(${-dragX}px)`,
              transition: artTransition,
              overflow: 'visible',
            }}
          >
            {/* Art strip: prev ghost | current | next ghost */}
            <div
              className="flex-1 flex items-center justify-center min-h-0"
              style={{ overflow: 'visible' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                {/* Prev ghost */}
                <div
                  style={{
                    opacity: dragX < 0 ? Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD) : 0,
                    boxShadow: '0 16px 36px rgba(0,0,0,0.5)',
                    borderRadius: '20px',
                    transition: isDragging ? 'none' : 'opacity 0.2s',
                  }}
                >
                  <ArtBox coverArt={ghostCover} title={prevTrack?.track} size={ART_SIZE} />
                </div>

                {/* Current art */}
                <div style={{ boxShadow: '0 28px 55px rgba(0,0,0,0.55), inset 0 0 0 0.5px rgba(255,255,255,0.08)', borderRadius: '20px' }}>
                  <ArtBox coverArt={currentTrack?.coverArt} title={currentTrack?.title} size={ART_SIZE} />
                </div>

                {/* Next ghost */}
                <div
                  style={{
                    opacity: dragX > 0 ? Math.min(1, dragX / SWIPE_THRESHOLD) : 0,
                    boxShadow: '0 16px 36px rgba(0,0,0,0.5)',
                    borderRadius: '20px',
                    transition: isDragging ? 'none' : 'opacity 0.2s',
                  }}
                >
                  <ArtBox coverArt={ghostCover} title={nextTrack?.track} size={ART_SIZE} />
                </div>
              </div>
            </div>

            {/* Track info — moves with art */}
            <div className="px-6 flex flex-col gap-1">
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
          </div>

          {/* Fixed controls layer */}
          <div
            className="flex-shrink-0 flex flex-col gap-4 px-6"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
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

        {/* Queue panel — always rendered, transform-driven */}
        <div
          className="absolute inset-0 z-10 flex flex-col bg-slate-950"
          style={{
            transform: `translateY(${queueTranslateY})`,
            transition: queueTransition,
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
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
      </div>

      {/* Like modal */}
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
```

**Note on `currentTrack.id` and `currentTrack.spotifyId`:** These fields appear in the original file. Keep them as-is — they exist on the `Track` type in `AudioContext`. Do not remove or rename them.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see `Property 'id' does not exist` or `Property 'spotifyId' does not exist`, it means those fields were removed — check the `Track` type in `src/contexts/AudioContext.tsx` and update the field names to match.

- [ ] **Step 3: Run dev server and verify in browser**

```bash
npm run dev
```

Open Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M) → select a phone preset (e.g. iPhone 12 Pro).

Open the app, start a track from an album (so there's a queue). Open the full player. Test:

1. **Horizontal swipe left** — album art should slide left, next track art peeks in from right. Controls (progress bar, play button) stay fixed.
2. **Horizontal swipe right** — album art slides right, prev track art peeks in from left. Controls stay fixed.
3. **Swipe up** — queue panel slides up from bottom. Partial drag should show a peek, releasing past 30% of screen height snaps it open, releasing below 30% snaps it back.
4. **Swipe down on queue** — queue snaps closed.
5. **Swipe down on player** — player closes.
6. **Close button (×) on queue** — still works.
7. **Like / Share / Download / Queue buttons** — still work.

- [ ] **Step 4: Commit**

```bash
git add src/components/MobilePlayer.tsx
git commit -m "feat: swipe animations — art drag, ghost peek, queue slide"
```

---

## Notes for the implementer

- `ART_SIZE` is a CSS string used in both the current art and ghost art `<ArtBox>` components. All three arts in the strip have identical dimensions so they align cleanly.
- The `overflow: 'visible'` on the body and draggable wrapper allows the ghost arts (which sit outside the art strip's bounding box) to be visible during drag. The outermost `overflow-hidden` on the `fixed inset-0` container clips them at screen edges.
- The queue panel is always in the DOM (no conditional mount). When `showQueue = false` and `dragY = 0`, it is at `translateY(100%)` — off-screen below. This avoids the visual flash that occurred with conditional mounting when the transition starts.
- `onDragEnd` reads `dragY` from the closure of the handler object, which is updated each render via `handlersRef.current = handlers`. By the time `touchend` fires, the handler has the latest `dragY` value.
