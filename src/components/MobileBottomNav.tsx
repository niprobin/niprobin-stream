import { Home, Compass, MoreHorizontal, Music, Play, Pause, SkipForward } from 'lucide-react'
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
  const { currentTrack, isPlaying, pause, resume, playNextTrack, currentTime, duration } = useAudio()

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Mini-player card — docked above the nav */}
      {currentTrack && (
        <div
          className="mx-3 mb-2 rounded-[14px] bg-slate-800 cursor-pointer active:opacity-90 transition-opacity overflow-hidden"
          onClick={onNowPlayingClick}
          role="button"
          aria-label="Open full player"
        >
          <div className="flex items-center gap-[11px] px-[11px] py-[9px]">
            {/* Art */}
            <div className="flex-shrink-0 w-[38px] h-[38px] rounded-[7px] overflow-hidden">
              {currentTrack.coverArt ? (
                <img
                  src={currentTrack.coverArt}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #534AB7, #1D9E75)' }}
                >
                  <Music className="h-[14px] w-[14px] text-white/70" />
                </div>
              )}
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white truncate leading-tight">
                {currentTrack.title}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {currentTrack.artist}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-[14px] flex-shrink-0 pr-1 text-white">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  isPlaying ? pause() : resume()
                }}
                className="flex items-center justify-center active:scale-95 transition-transform"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying
                  ? <Pause className="h-[18px] w-[18px]" />
                  : <Play className="h-[18px] w-[18px]" />
                }
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  playNextTrack()
                }}
                className="flex items-center justify-center active:scale-95 transition-transform"
                aria-label="Next track"
              >
                <SkipForward className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>

          {/* Progress scrubber — 3px bar pinned to bottom */}
          <div className="h-[3px] w-full bg-white/10">
            <div
              className="h-full bg-blue-400 transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav
        className="flex bg-slate-950 border-t border-slate-800"
        style={{
          height: '64px',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0px)',
        }}
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
              className={`flex-1 flex flex-col items-center justify-center gap-[5px] transition-colors min-h-[44px] ${
                isActive ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span className="text-[11px] font-semibold">{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
