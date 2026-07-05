import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

// Builds a compact page list with `null` gaps for ellipses, always keeping
// the first/last page and a window around the current page visible.
function buildPageList(currentPage: number, totalPages: number): (number | null)[] {
  const pages = new Set<number>([1, totalPages])
  for (let p = currentPage - 1; p <= currentPage + 1; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p)
  }

  const sorted = Array.from(pages).sort((a, b) => a - b)
  const result: (number | null)[] = []
  let prev: number | undefined
  for (const p of sorted) {
    if (prev !== undefined && p - prev > 1) result.push(null)
    result.push(p)
    prev = p
  }
  return result
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange, className }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)
  const pageList = buildPageList(currentPage, totalPages)

  return (
    <div className={cn('flex items-center justify-center gap-[6px]', className)}>
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="flex items-center justify-center w-8 h-8 rounded-sm-crate text-text-2 disabled:opacity-30 disabled:cursor-not-allowed hover:text-text-1 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {pageList.map((page, i) =>
        page === null ? (
          <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-text-3 text-xs font-mono-label">
            &hellip;
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            aria-label={`Go to page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
            className={cn(
              'w-8 h-8 flex items-center justify-center rounded-sm-crate text-[13px] font-medium transition-colors',
              page === currentPage
                ? 'bg-accent text-accent-ink'
                : 'text-text-2 hover:text-text-1'
            )}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
        className="flex items-center justify-center w-8 h-8 rounded-sm-crate text-text-2 disabled:opacity-30 disabled:cursor-not-allowed hover:text-text-1 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
