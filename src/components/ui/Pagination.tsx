import { Button } from '@/components/ui/button'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ currentPage, totalItems, pageSize, onPageChange, className }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)

  return (
    <div className={cn("text-xs text-slate-400 flex items-center justify-center gap-3", className)}>
      <Button
        className="text-xs"
        variant="ghost"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(1)}
        aria-label="Go to first page"
      >
        <ChevronsLeft className="h-3 w-3 mr-1" />
        First
      </Button>
      <Button
        className="text-xs"
        variant="ghost"
        size="sm"
        disabled={currentPage === 1}
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
      >
        Prev
      </Button>
      <span>Page {currentPage} of {totalPages}</span>
      <Button
        className="text-xs"
        variant="ghost"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
      >
        Next
      </Button>
      <Button
        className="text-xs"
        variant="ghost"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(totalPages)}
        aria-label="Go to last page"
      >
        Last
        <ChevronsRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  )
}