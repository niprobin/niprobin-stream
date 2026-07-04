import { RefreshCw, Home, Compass, Search } from 'lucide-react'
import { Logo } from './ui/Logo'

interface SidebarProps {
  isAuthenticated: boolean
  activePage: 'home' | 'digging' | 'album' | 'artist' | 'search' | 'menu'
  diggingTab: 'tracks' | 'albums'
  username?: string | null
  isRefreshing: boolean
  onNavigateHome: () => void
  onNavigateDigging: () => void
  onNavigateDiggingTab: (tab: 'tracks' | 'albums') => void
  onNavigateSearch: () => void
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
  username,
  isRefreshing,
  onNavigateHome,
  onNavigateDigging,
  onNavigateDiggingTab,
  onNavigateSearch,
  onRefresh,
  onLogout,
}: SidebarProps) {
  const navItemClass = (active: boolean) =>
    `flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-sm-crate transition-colors ${
      active
        ? 'bg-accent/12 text-accent'
        : 'text-text-2 hover:text-text-1 hover:bg-bg-2/50'
    }`

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
            aria-selected={activePage === 'digging'}
            onClick={onNavigateDigging}
            className={navItemClass(activePage === 'digging')}
          >
            <Compass className="h-[18px] w-[18px]" />
            Digging
          </button>

          {/* Digging sub-tabs */}
          {activePage === 'digging' && (
            <div className="pl-6 pt-1 space-y-1" role="tablist" aria-label="Digging sections">
              <button
                type="button"
                role="tab"
                aria-selected={diggingTab === 'tracks'}
                onClick={() => onNavigateDiggingTab('tracks')}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-sm-crate transition-colors ${
                  diggingTab === 'tracks' ? 'text-text-1' : 'text-text-3 hover:text-text-2'
                }`}
              >
                Tracks
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={diggingTab === 'albums'}
                onClick={() => onNavigateDiggingTab('albums')}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-sm-crate transition-colors ${
                  diggingTab === 'albums' ? 'text-text-1' : 'text-text-3 hover:text-text-2'
                }`}
              >
                Albums
              </button>
            </div>
          )}

          <button
            type="button"
            role="tab"
            aria-selected={activePage === 'search'}
            onClick={onNavigateSearch}
            className={navItemClass(activePage === 'search')}
          >
            <Search className="h-[18px] w-[18px]" />
            Search
          </button>
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
