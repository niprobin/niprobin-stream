import { X } from 'lucide-react'
import type { AlbumTrackItem } from '@/contexts/AudioContext'
import { TrackList } from '@/components/TrackList'

interface QueueProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  tracks: AlbumTrackItem[]
  onSelectTrack: (track: AlbumTrackItem, trackIndex: number) => void
  onPickTrack: (track: AlbumTrackItem) => void
  currentTrackId?: string | null
  isPlaying?: boolean
  loadingTrackId?: string | null
  isAuthenticated: boolean
}

/**
 * The queue: a slide-in panel from the right edge of the docked player,
 * toggled by a button click. Rows reuse `TrackList` unchanged.
 */
export function Queue({
  isOpen,
  onClose,
  title,
  subtitle,
  tracks,
  onSelectTrack,
  onPickTrack,
  currentTrackId,
  isPlaying,
  loadingTrackId,
  isAuthenticated,
}: QueueProps) {
  const trackList = (
    <TrackList
      variant="album"
      tracks={tracks}
      onSelect={onSelectTrack}
      enablePickButtons={isAuthenticated}
      onPickTrack={onPickTrack}
      currentTrackId={currentTrackId}
      isPlaying={isPlaying}
      loadingTrackId={loadingTrackId}
      isAuthenticated={isAuthenticated}
      compactSpacing={true}
      showColumnHeaders={false}
    />
  )

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
