import { Home, Compass, ChevronUp, Music, Play, Pause, MoreHorizontal } from 'lucide-react'
import { useAudio } from '@/contexts/AudioContext'

interface MobileBottomNavProps {
  currentPage: 'home' | 'digging' | 'menu'
  onPageChange: (page: string) => void
  onNowPlayingClick: () => void
}

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'digging', label: 'Digging', icon: Compass },
  { id: 'menu', label: 'Menu', icon: MoreHorizontal },
] as const

export function MobileBottomNav({ currentPage, onPageChange, onNowPlayingClick }: MobileBottomNavProps) {
  const { currentTrack, isPlaying, pause, resume } = useAudio()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Now-playing strip */}
      {currentTrack && (
        <div
          className="flex items-center gap-3 px-3 bg-slate-900 border-t border-slate-800 cursor-pointer active:bg-slate-800 transition-colors"
          style={{ height: '52px' }}
          onClick={onNowPlayingClick}
          role="button"
          aria-label="Open full player"
        >
          {/* Album cover */}
          <div className="flex-shrink-0 relative w-9 h-9">
            {currentTrack.coverArt ? (
              <img
                src={currentTrack.coverArt}
                alt=""
                className="w-9 h-9 rounded object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const sib = e.currentTarget.nextElementSibling as HTMLElement
                  if (sib) sib.style.display = 'flex'
                }}
              />
            ) : null}
            <div
              className={`w-9 h-9 rounded items-center justify-center ${currentTrack.coverArt ? 'hidden' : 'flex'}`}
              style={{ background: 'linear-gradient(135deg, #534AB7, #1D9E75)' }}
            >
              <Music className="h-4 w-4 text-white/70" />
            </div>
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white truncate leading-tight">
              {currentTrack.title}
            </div>
            <div className="text-[11px] text-white/50 truncate mt-0.5">
              {currentTrack.artist}
            </div>
          </div>

          {/* Play/pause button — stops propagation so it doesn't open the full player */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              isPlaying ? pause() : resume()
            }}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-white text-black active:scale-95 transition-transform"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>

          <ChevronUp className="flex-shrink-0 h-4 w-4 text-slate-400" />
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav
        className="flex bg-slate-950 border-t border-slate-800"
        style={{ height: '56px', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        aria-label="Primary navigation"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = currentPage === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPageChange(id)}
              aria-label={`Go to ${label}`}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-200 min-h-[44px] ${
                isActive ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
