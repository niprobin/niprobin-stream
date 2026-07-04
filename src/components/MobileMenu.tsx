import { RefreshCw } from 'lucide-react'

interface MobileMenuProps {
  isAuthenticated: boolean
  username?: string | null
  isRefreshing: boolean
  onRefresh: () => void
  onLogout: () => void
}

/**
 * Mobile "Menu" page content (< lg), reachable via MobileBottomNav.
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
      <h2 className="text-white text-xl font-semibold">Menu</h2>

      {isAuthenticated && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Discovery</p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl bg-slate-900 text-white disabled:opacity-40 active:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`h-5 w-5 text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Refreshing…' : 'Refresh discovery'}
            </span>
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-slate-500 uppercase tracking-wider">Account</p>
        <div className="px-4 py-3 rounded-xl bg-slate-900 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">{username ?? 'User'}</p>
            <p className="text-xs text-slate-500">Signed in</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
