import { X } from 'lucide-react'
import type { AlbumTrackItem } from '@/contexts/AudioContext'
import { TrackList } from '@/components/TrackList'

const SPRING = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

interface QueueProps {
  /**
   * `sheet` = mobile bottom-sheet, revealed/hidden via a transform the caller
   * drives from `usePlayerGestures` (drag-to-open + swipe). `panel` = desktop
   * slide-in overlay from the right edge, toggled by a button click.
   */
  variant: 'sheet' | 'panel'
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  tracks: AlbumTrackItem[]
  onSelectTrack: (track: AlbumTrackItem, trackIndex: number) => void
  onLikeTrack: (track: AlbumTrackItem) => void
  currentTrackId?: string | null
  loadingTrackId?: string | null
  isAuthenticated: boolean
  /** sheet-only: live drag reveal offset in px (from `usePlayerGestures`). */
  dragOffset?: number
  /** sheet-only: whether a drag is in progress (disables the spring). */
  isDragging?: boolean
}

/**
 * Shared queue view used by both the desktop docked player (`panel`) and the
 * mobile full-screen player (`sheet`). Both variants reuse `TrackList` unchanged
 * for the actual rows; only the surrounding surface/header/animation differ.
 *
 * Open-state stays with each caller: desktop toggles `isOpen` on a button click,
 * mobile drives `isOpen`/`dragOffset`/`isDragging` from the multi-purpose
 * `usePlayerGestures` handler it already owns (art swipe + player-close + queue
 * reveal share one gesture), so that hook is not lifted in here.
 */
export function Queue({
  variant,
  isOpen,
  onClose,
  title,
  subtitle,
  tracks,
  onSelectTrack,
  onLikeTrack,
  currentTrackId,
  loadingTrackId,
  isAuthenticated,
  dragOffset = 0,
  isDragging = false,
}: QueueProps) {
  const trackList = (
    <TrackList
      variant="album"
      tracks={tracks}
      onSelect={onSelectTrack}
      enableLikeButtons={isAuthenticated}
      onLikeTrack={onLikeTrack}
      currentTrackId={currentTrackId}
      loadingTrackId={loadingTrackId}
      isAuthenticated={isAuthenticated}
      compactSpacing={true}
      showColumnHeaders={false}
    />
  )

  if (variant === 'sheet') {
    const translateY = isOpen ? '0%' : `calc(100% - ${dragOffset}px)`
    return (
      <div
        className="absolute inset-0 z-10 flex flex-col bg-bg-0-deep"
        style={{
          transform: `translateY(${translateY})`,
          transition: isDragging ? 'none' : SPRING,
        }}
        aria-hidden={!isOpen}
        ref={(el) => {
          if (el) el.inert = !isOpen
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 flex justify-center pb-1"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)' }}
        >
          <div className="w-9 h-1 rounded-full bg-text-3/40" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-2 pb-3">
          <div className="min-w-0">
            <h3 className="font-serif-display italic text-2xl text-text-1 leading-tight truncate">{title}</h3>
            <p className="text-xs text-text-2 truncate">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-bg-2 text-text-2 hover:text-text-1 transition-colors"
            aria-label="Close queue"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tracklist */}
        <div
          className="flex-1 overflow-y-auto min-h-0"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {trackList}
        </div>
      </div>
    )
  }

  // panel (desktop slide-in overlay)
  return (
    <div
      className={`fixed top-0 right-0 bottom-0 w-80 z-50 flex flex-col bg-bg-0-deep border-l border-border shadow-2xl transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <h3 className="font-serif-display italic text-xl text-text-1 leading-tight truncate">{title}</h3>
          <p className="text-xs text-text-2 truncate">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-text-2 hover:text-text-1 hover:bg-bg-2 transition-colors"
          aria-label="Close queue"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tracklist */}
      <div className="flex-1 overflow-y-auto min-h-0">{trackList}</div>
    </div>
  )
}
