import { RefreshCw, Home, Music, Disc3 } from 'lucide-react'
import { Logo } from './ui/Logo'
import type { AlbumsView } from '@/utils/albumUtils'

interface SidebarProps {
  isAuthenticated: boolean
  activePage: 'home' | 'digging' | 'album' | 'artist' | 'search' | 'menu'
  diggingTab: 'tracks' | 'albums'
  tracksCount?: number
  albumsView: AlbumsView
  albumsCount?: number
  listenCount?: number
  username?: string | null
  isRefreshing: boolean
  onNavigateHome: () => void
  onNavigateTracks: () => void
  onNavigateAlbumsView: (view: AlbumsView) => void
  onRefresh: () => void
  onLogout: () => void
}

/**
 * Desktop sidebar (>= lg), Crate design system. 232px vertical nav + account
 * card. Always mounted; visibility handled by `hidden lg:flex`.
 */
export function Sidebar({
  isAuthenticated,
  activePage,
  diggingTab,
  tracksCount,
  albumsView,
  albumsCount,
  listenCount,
  username,
  isRefreshing,
  onNavigateHome,
  onNavigateTracks,
  onNavigateAlbumsView,
  onRefresh,
  onLogout,
}: SidebarProps) {
  const navItemClass = (active: boolean) =>
    `flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-sm-crate transition-colors ${
      active
        ? 'bg-accent/12 text-accent'
        : 'text-text-2 hover:text-text-1 hover:bg-bg-2/50'
    }`

  const isTracksActive = activePage === 'digging' && diggingTab === 'tracks'
  const isAlbumsListActive = activePage === 'digging' && diggingTab === 'albums'
  // Album detail pages belong to the Albums section
  const isAlbumsActive = isAlbumsListActive || activePage === 'album'

  return (
    <aside className="hidden lg:flex flex-col flex-shrink-0 w-[232px] h-full bg-bg-0-deep border-r border-border">
      {/* Logo + wordmark */}
      <div className="px-5 py-5">
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Logo size={34} />
          <span className="font-serif-display italic text-2xl text-text-1">nipstream</span>
        </button>
      </div>

      {/* Primary nav */}
      {isAuthenticated && (
        <nav className="px-3 space-y-1" role="tablist" aria-label="Primary pages">
          <button
            type="button"
            role="tab"
            aria-selected={activePage === 'home'}
            onClick={onNavigateHome}
            className={navItemClass(activePage === 'home')}
          >
            <Home className="h-[18px] w-[18px]" />
            Home
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isTracksActive}
            onClick={onNavigateTracks}
            className={navItemClass(isTracksActive)}
          >
            <Music className="h-[18px] w-[18px]" />
            <span className="flex-1 text-left">Tracks</span>
            {typeof tracksCount === 'number' && tracksCount > 0 && (
              <span className="text-xs font-mono text-text-3">{tracksCount}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isAlbumsActive}
            onClick={() => onNavigateAlbumsView('backlog')}
            className={navItemClass(isAlbumsActive)}
          >
            <Disc3 className="h-[18px] w-[18px]" />
            <span className="flex-1 text-left">Albums</span>
          </button>
          <div className="space-y-0.5">
            {([
              { view: 'backlog', label: 'Backlog', count: albumsCount },
              { view: 'listen', label: 'Listen to', count: listenCount },
            ] as const).map(({ view, label, count }) => {
              const isActive = isAlbumsListActive && albumsView === view
              return (
                <button
                  key={view}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onNavigateAlbumsView(view)}
                  className={`flex items-center w-full pl-[42px] pr-3 py-1.5 text-[13px] rounded-sm-crate transition-colors ${
                    isActive ? 'text-accent font-medium' : 'text-text-3 hover:text-text-1'
                  }`}
                >
                  <span className="flex-1 text-left">{label}</span>
                  {typeof count === 'number' && count > 0 && (
                    <span className="text-xs font-mono text-text-3">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      )}

      <div className="flex-1" />

      {/* Refresh discovery */}
      {isAuthenticated && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-sm-crate text-text-2 hover:text-text-1 hover:bg-bg-2/50 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-[18px] w-[18px] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Refreshing…' : 'Refresh discovery'}
            </span>
          </button>
        </div>
      )}

      {/* Account card */}
      <div className="px-3 pb-5">
        <div className="px-3 py-3 rounded-md-crate bg-bg-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-1 truncate">{username ?? 'User'}</p>
            <p className="text-xs text-text-3">Signed in</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-text-2 hover:text-text-1 transition-colors flex-shrink-0"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
