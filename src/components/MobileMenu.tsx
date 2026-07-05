import { RefreshCw } from 'lucide-react'

interface MobileMenuProps {
  isAuthenticated: boolean
  username?: string | null
  isRefreshing: boolean
  onRefresh: () => void
  onLogout: () => void
}

/**
 * Mobile "Menu" page content (< lg), reachable via the PlayerBar nav tabs.
 * Extracted from App.tsx's inline `mobileMenuContent`.
 */
export function MobileMenu({
  isAuthenticated,
  username,
  isRefreshing,
  onRefresh,
  onLogout,
}: MobileMenuProps) {
  return (
    <div className="py-8 px-6 space-y-6">
      <h2 className="text-text-1 text-xl font-semibold">Menu</h2>

      {isAuthenticated && (
        <div className="space-y-2">
          <p className="text-xs text-text-3 uppercase tracking-wider">Discovery</p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-md-crate bg-bg-1 text-text-1 disabled:opacity-40 active:bg-bg-2 transition-colors"
          >
            <RefreshCw className={`h-5 w-5 text-text-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Refreshing…' : 'Refresh discovery'}
            </span>
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-text-3 uppercase tracking-wider">Account</p>
        <div className="px-4 py-3 rounded-md-crate bg-bg-1 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-1">{username ?? 'User'}</p>
            <p className="text-xs text-text-3">Signed in</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-text-2 hover:text-text-1 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
