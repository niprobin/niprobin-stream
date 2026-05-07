function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function CarouselSection({
  title,
  seeAllHref,
  children,
}: {
  title: string
  seeAllHref?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">{title}</h2>
        {seeAllHref && (
          <button
            onClick={() => navigateTo(seeAllHref)}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            See all →
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide">
        {children}
      </div>
    </section>
  )
}
