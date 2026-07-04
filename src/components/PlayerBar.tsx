import { Home, Compass, MoreHorizontal, Play, Pause, SkipForward } from 'lucide-react'
import { useAudio } from '@/contexts/AudioContext'
import { CoverArtPlaceholder } from '@/components/ui/CoverArtPlaceholder'
import { Player } from './Player'

interface PlayerBarProps {
  currentPage: 'home' | 'digging' | 'menu'
  onPageChange: (page: string) => void
  onNowPlayingClick: () => void
}

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'digging', label: 'Digging', icon: Compass },
  { id: 'menu', label: 'Menu', icon: MoreHorizontal },
] as const

/**
 * The single floating player+nav surface.
 *
 * Mobile (< lg): one card (`rounded-lg-crate bg-bg-2`) that stacks the
 * mini-player, its progress scrubber and the 3-tab navigation row — matching
 * the Crate design's single-card treatment. This is the ONLY mobile chrome;
 * there is no separate bottom-nav component.
 *
 * Desktop (>= lg): the tab row is dropped (the Sidebar owns navigation) and the
 * component becomes the full-width-minus-sidebar docked bar, rendered in-flow at
 * the bottom of the main column via the existing `Player` transport UI.
 */
export function PlayerBar({ currentPage, onPageChange, onNowPlayingClick }: PlayerBarProps) {
  const { currentTrack, isPlaying, pause, resume, playNextTrack, currentTime, duration } = useAudio()

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <>
      {/* ── Mobile: single floating card (mini-player + progress + nav) ── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-[14px]"
        style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className="rounded-lg-crate bg-bg-2 overflow-hidden"
          style={{ boxShadow: '0 18px 34px rgba(0,0,0,0.45)' }}
        >
          {currentTrack ? (
            <>
              {/* Mini-player row — opens the full player */}
              <div
                className="flex items-center gap-[10px] px-[10px] py-[9px] cursor-pointer active:opacity-90 transition-opacity"
                onClick={onNowPlayingClick}
                role="button"
                aria-label="Open full player"
              >
                {/* Art: 11px matches design HTML exactly at this size; off-scale from the
                    10/16/22 token ramp but kept for fidelity to the mini-player reference. */}
                {currentTrack.coverArt ? (
                  <img
                    src={currentTrack.coverArt}
                    alt=""
                    className="w-[38px] h-[38px] rounded-[11px] object-cover flex-shrink-0"
                  />
                ) : (
                  <CoverArtPlaceholder size={38} radius={11} showLabel={false} />
                )}

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-text-1 truncate leading-tight">
                    {currentTrack.title}
                  </div>
                  <div className="text-[11px] text-text-2 truncate mt-0.5">
                    {currentTrack.artist}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-[14px] flex-shrink-0 pr-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      isPlaying ? pause() : resume()
                    }}
                    className="flex items-center justify-center text-accent active:scale-95 transition-transform"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying
                      ? <Pause className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                      : <Play className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                    }
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      playNextTrack()
                    }}
                    className="flex items-center justify-center text-text-1 active:scale-95 transition-transform"
                    aria-label="Next track"
                  >
                    <SkipForward className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
                  </button>
                </div>
              </div>

              {/* Progress scrubber */}
              <div className="h-[2.5px] w-full bg-border">
                <div
                  className="h-full bg-accent transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <div className="h-[44px] flex items-center px-4">
              <span className="text-[12px] text-text-2">Nothing playing</span>
            </div>
          )}

          {/* Navigation row */}
          <nav
            className={`flex items-center justify-around px-2 pb-3 ${currentTrack ? 'pt-[10px]' : ''}`}
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
                  className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] transition-colors ${
                    isActive ? 'text-accent' : 'text-text-3'
                  }`}
                >
                  <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
                  <span className={`text-[10px] ${isActive ? 'font-semibold' : ''}`}>{label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* ── Desktop: full-width-minus-sidebar docked bar ── */}
      <div className="hidden lg:block lg:shrink-0">
        <Player />
      </div>
    </>
  )
}
