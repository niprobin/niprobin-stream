import { SearchBar } from './SearchBar'

interface MobileHeaderProps {
  isAuthenticated: boolean
  showSearch: boolean
  onLogoClick: () => void
}

/**
 * Mobile top header (< lg) — logo + search. Placeholder structure; full
 * visual restyle is Task 4. Visibility handled by `lg:hidden`.
 */
export function MobileHeader({ isAuthenticated, showSearch, onLogoClick }: MobileHeaderProps) {
  return (
    <header
      className="lg:hidden flex-shrink-0 bg-slate-950"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-3 px-[18px] pt-[10px] pb-[6px]">
        <button
          type="button"
          onClick={onLogoClick}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
          aria-label="Go home"
        >
          <img src="/android-chrome-192x192.png" alt="nipstream logo" className="w-8 h-8" />
        </button>
        {isAuthenticated && showSearch && (
          <div className="flex-1 min-w-0">
            <SearchBar containerClassName="h-[42px] !rounded-[12px]" />
          </div>
        )}
      </div>
    </header>
  )
}
