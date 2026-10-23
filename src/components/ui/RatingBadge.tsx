import { ratingBadge } from '@/digging/albumStatus'

// The saved rating on an album cover, display only
export function RatingBadge({ rating }: { rating: number }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded-sm-crate bg-black/70 text-accent text-xs font-medium"
      aria-label={`Rated ${rating} out of 5`}
    >
      {ratingBadge(rating)}
    </span>
  )
}
