import { SearchBar } from './SearchBar'
import { Logo } from '@/components/ui/Logo'

interface MobileHeaderProps {
  isAuthenticated: boolean
  showSearch: boolean
  onLogoClick: () => void
}

/**
 * Mobile top header (< lg) — logo + search. Visibility handled by `lg:hidden`.
 */
export function MobileHeader({ isAuthenticated, showSearch, onLogoClick }: MobileHeaderProps) {
  return (
    <header
      className="lg:hidden flex-shrink-0 bg-bg-0"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-3 px-[18px] pt-[10px] pb-[6px]">
        <button
          type="button"
          onClick={onLogoClick}
          className="flex-shrink-0 hover:opacity-80 transition-opacity"
          aria-label="Go home"
        >
          <Logo size={34} />
        </button>
        {isAuthenticated && showSearch && (
          <div className="flex-1 min-w-0">
            <SearchBar containerClassName="h-[42px]" />
          </div>
        )}
      </div>
    </header>
  )
}
