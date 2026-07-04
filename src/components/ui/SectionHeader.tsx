function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Crate-styled section heading: Instrument Serif italic title + optional
 * accent "See all" link.
 *
 * NOT yet wired into `CarouselSection` — this is the new Crate-design
 * primitive that the Home (Task 7), Digging (Task 8), and Search (Task 9)
 * redesign tasks will swap `CarouselSection`'s header (or its call sites)
 * over to. Keeping it standalone avoids prematurely restyling section
 * headers on pages that haven't been redesigned yet.
 */
export function SectionHeader({
  title,
  seeAllHref,
  onSeeAll,
  className = '',
}: {
  title: string
  seeAllHref?: string
  onSeeAll?: () => void
  className?: string
}) {
  return (
    <div className={`flex items-baseline justify-between ${className}`}>
      <h2 className="font-serif-display italic text-2xl text-text-1">{title}</h2>
      {(seeAllHref || onSeeAll) && (
        <button
          onClick={onSeeAll ?? (() => navigateTo(seeAllHref!))}
          className="ml-2.5 shrink-0 text-[11.5px] text-accent hover:opacity-80 transition-opacity"
        >
          See all
        </button>
      )}
    </div>
  )
}
