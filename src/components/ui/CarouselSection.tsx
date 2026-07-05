import type { ReactNode } from 'react'
import { SectionHeader } from './SectionHeader'

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
