import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  onRatingChange: (rating: number) => void
  disabled?: boolean
  className?: string
}

export function StarRating({ rating, onRatingChange, disabled, className }: StarRatingProps) {
  return (
    <div className={cn("flex gap-1 px-2 py-1 rounded-lg bg-slate-800/30", className)} role="radiogroup" aria-label="Album rating">
      {[1, 2, 3, 4, 5].map((value) => {
        const isActive = rating >= value
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${isActive ? 'text-yellow-300' : 'text-slate-500'} hover:text-yellow-300`}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            onClick={() => onRatingChange(value)}
          >
            <Star className="h-4 w-4" fill={isActive ? 'currentColor' : 'none'} />
          </Button>
        )
      })}
    </div>
  )
}