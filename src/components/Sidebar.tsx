import { RefreshCw } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { Button } from './ui/button'

interface SidebarProps {
  isAuthenticated: boolean
  activePage: 'home' | 'digging' | 'album' | 'artist' | 'search' | 'menu'
  diggingTab: 'tracks' | 'albums'
  username?: string | null
  isRefreshing: boolean
  onNavigateHome: () => void
  onNavigateDigging: () => void
  onNavigateDiggingTab: (tab: 'tracks' | 'albums') => void
  onRefresh: () => void
  onLogout: () => void
}

/**
 * Desktop sidebar (>= lg). Placeholder structure — full visual restyle is Task 4.
 * Always mounted; visibility handled by `hidden lg:flex`.
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
  onRefresh,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col flex-shrink-0 w-[232px] h-full bg-slate-950 border-r border-slate-800">
      {/* Logo */}
      <div className="px-5 py-5">
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img src="/android-chrome-192x192.png" alt="nipstream logo" className="w-8 h-8" />
        </button>
      </div>

      {/* Search */}
      {isAuthenticated && (
        <div className="px-4 pb-4">
          <SearchBar />
        </div>
      )}

      {/* Primary nav */}
      {isAuthenticated && (
        <nav className="px-3 space-y-1" role="tablist" aria-label="Primary pages">
          <button
            type="button"
            role="tab"
            aria-selected={activePage === 'home'}
            onClick={onNavigateHome}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition ${
              activePage === 'home'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            Home
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activePage === 'digging'}
            onClick={onNavigateDigging}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition ${
              activePage === 'digging'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            Digging
          </button>

          {/* Digging sub-tabs */}
          {activePage === 'digging' && (
            <div className="pl-3 pt-1 space-y-1" role="tablist" aria-label="Digging sections">
              <button
                type="button"
                role="tab"
                aria-selected={diggingTab === 'tracks'}
                onClick={() => onNavigateDiggingTab('tracks')}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition ${
                  diggingTab === 'tracks' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Tracks
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={diggingTab === 'albums'}
                onClick={() => onNavigateDiggingTab('albums')}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition ${
                  diggingTab === 'albums' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Albums
              </button>
            </div>
          )}
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
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/50 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Refreshing…' : 'Refresh discovery'}
            </span>
          </button>
        </div>
      )}

      {/* Account card */}
      <div className="px-3 pb-5">
        <div className="px-3 py-3 rounded-xl bg-slate-900 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{username ?? 'User'}</p>
            <p className="text-xs text-slate-500">Signed in</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-slate-400 hover:text-white hover:bg-slate-800 flex-shrink-0"
          >
            Logout
          </Button>
        </div>
      </div>
    </aside>
  )
}
