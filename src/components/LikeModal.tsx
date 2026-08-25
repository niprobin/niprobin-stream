import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EyebrowLabel } from '@/components/ui/EyebrowLabel'

interface LikeModalProps {
  isOpen: boolean
  track: { title: string; artist: string } | null
  playlists: readonly string[]
  selectedPlaylist: string
  isSubmitting: boolean
  onSelectPlaylist: (playlist: string) => void
  onSubmit: (event: FormEvent) => void
  onClose: () => void
}

/**
 * Shared Add-to-playlist ("Like") drawer — bottom sheet on mobile, right-side
 * panel on desktop, mirroring the Queue component's sheet/panel convention.
 * Runs the full viewport height on desktop (top-0/bottom-0) instead of a
 * centered card with its own height budget, so the playlist list has room to
 * scroll internally without ever pushing the Cancel/Add row off-screen.
 * Presentational only: the `useLikeModal` hook stays in each caller.
 */
export function LikeModal({
  isOpen,
  track,
  playlists,
  selectedPlaylist,
  isSubmitting,
  onSelectPlaylist,
  onSubmit,
  onClose,
}: LikeModalProps) {
  if (!isOpen || !track) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
        onClick={onClose}
        aria-hidden="true"
      />
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        className="fixed z-[9999] flex flex-col bg-bg-1 border-border shadow-2xl p-5 space-y-4
          inset-x-0 bottom-0 max-h-[85vh] rounded-t-lg-crate border-t
          md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:left-auto md:h-full md:max-h-none
          md:w-96 md:rounded-t-none md:rounded-l-lg-crate md:border-t-0 md:border-l"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <EyebrowLabel>Add to playlist</EyebrowLabel>
            <p className="text-text-1 text-lg font-semibold truncate mt-1">{track.title}</p>
            <p className="text-text-2 text-sm truncate">{track.artist}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-text-2 hover:text-text-1 flex-shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1 min-h-0 overflow-y-auto pr-1">
          {playlists.map((playlist) => (
            <button
              type="button"
              key={playlist}
              onClick={() => onSelectPlaylist(playlist)}
              className={`text-left text-sm px-3 py-2.5 rounded-md-crate border transition-colors ${
                selectedPlaylist === playlist
                  ? 'border-accent bg-accent/12 text-text-1 font-medium'
                  : 'border-border text-text-2 hover:border-text-3'
              }`}
            >
              {playlist}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            className="text-text-2 hover:text-text-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-accent text-accent-ink hover:bg-accent/90"
            disabled={isSubmitting || !selectedPlaylist}
          >
            {isSubmitting ? 'Saving...' : 'Add'}
          </Button>
        </div>
      </form>
    </>
  )
}
