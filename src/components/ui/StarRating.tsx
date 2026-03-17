import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  onRatingChange: (rating: number) => void
  disabled?: boolean
  className?: string
  inline?: boolean
  variant?: 'default' | 'compact'
}

// Custom designed star SVG component
const DesignedStar = ({ size = 16, filled = false, className = "" }: { size?: number, filled?: boolean, className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 19"
    fill="none"
    className={className}
  >
    <path
      d="M10 1.61803L12.3511 7.62623H18.7063L13.6776 11.2475L16.0287 17.2557L10 13.6344L3.97133 17.2557L6.32244 11.2475L1.29369 7.62623H7.64886L10 1.61803Z"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export function StarRating({ rating, onRatingChange, disabled, className, inline, variant = 'default' }: StarRatingProps) {
  const compact = variant === 'compact'

  const containerClasses = inline
    ? "flex gap-1"
    : cn("flex gap-1 px-2 py-1 rounded-lg bg-slate-800/30", className)

  const starSize = compact ? 15 : 16
  const buttonClasses = compact
    ? "h-6 w-6"
    : "h-8 w-8"

  if (inline) {
    return (
      <div className={containerClasses} role="radiogroup" aria-label="Album rating">
        {[1, 2, 3, 4, 5].map((value) => {
          const isActive = rating >= value
          return (
            <button
              key={value}
              type="button"
              className={`cursor-pointer transition-all duration-150 ${
                isActive ? 'text-yellow-300' : 'text-white/20'
              } hover:text-yellow-300 hover:scale-110`}
              disabled={disabled}
              aria-pressed={isActive}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              onClick={(e) => {
                e.stopPropagation()
                onRatingChange(value)
              }}
            >
              <DesignedStar size={starSize} filled={isActive} />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={containerClasses} role="radiogroup" aria-label="Album rating">
      {[1, 2, 3, 4, 5].map((value) => {
        const isActive = rating >= value
        return (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="icon"
            className={`${buttonClasses} transition-all duration-150 ${isActive ? 'text-yellow-300' : 'text-slate-500'} hover:text-yellow-300 hover:scale-110`}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            onClick={() => onRatingChange(value)}
          >
            <DesignedStar size={starSize} filled={isActive} />
          </Button>
        )
      })}
    </div>
  )
}