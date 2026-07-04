import type { ReactNode } from 'react'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/**
 * Section heading: Instrument Serif italic title + optional accent "See all"
 * link. Reused standalone (e.g. above non-carousel lists) as well as inside
 * CarouselSection below.
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

export function CarouselSection({
  title,
  seeAllHref,
  children,
}: {
  title: string
  seeAllHref?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <SectionHeader title={title} seeAllHref={seeAllHref} />
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide">
        {children}
      </div>
    </section>
  )
}
