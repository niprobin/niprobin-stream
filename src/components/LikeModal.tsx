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
 * Shared Add-to-playlist ("Like") modal — one centered-sheet treatment at every
 * breakpoint per the Crate spec (screenshot 09-like-modal). Presentational only:
 * the `useLikeModal` hook stays in each caller (Player / MobileFullPlayer) because
 * it also drives their heart trigger buttons (liked state + open action); this
 * component just renders the modal content from the props those callers pass in.
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
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] px-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={onSubmit}
        className="w-full md:max-w-sm h-[90vh] max-h-[720px] flex flex-col bg-bg-1 border border-border rounded-lg-crate p-5 space-y-4 shadow-2xl md:h-auto md:max-h-none"
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

        <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
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

        <div className="flex items-center justify-end gap-3">
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
    </div>
  )
}
