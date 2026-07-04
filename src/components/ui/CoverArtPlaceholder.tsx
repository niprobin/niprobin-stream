// Diagonal stripe placeholder used anywhere a track/album/artist cover
// image would go, per the Crate design system.
//
// The stripe colors below are the exact oklch values of the `bg-2`/`bg-1`
// Tailwind tokens (see tailwind.config.js) — they're inlined here because
// the stripe width scales with the `size` prop at runtime, which Tailwind's
// static utility classes can't express.
const STRIPE_LIGHT = 'oklch(0.25 0.022 55)' // bg-2
const STRIPE_DARK = 'oklch(0.21 0.02 55)' // bg-1

interface CoverArtPlaceholderProps {
  /** Width/height in px (the tile is always square). */
  size?: number
  /** Corner radius in px. Defaults to a size-appropriate Crate radius. */
  radius?: number
  /** Show the small "cover" mono label in the bottom-left corner. */
  showLabel?: boolean
  /** Render as a circle instead of a rounded square (e.g. artist avatars). */
  circular?: boolean
  className?: string
}

export function CoverArtPlaceholder({
  size = 96,
  radius,
  showLabel = true,
  circular = false,
  className = '',
}: CoverArtPlaceholderProps) {
  // Stripe pitch (N) scales with tile size: ~5px for small tiles up to ~9px
  // for large ones, matching the design reference's per-screen values.
  const stripe = Math.max(5, Math.min(9, Math.round(size / 16)))
  const resolvedRadius = circular ? size / 2 : (radius ?? Math.min(16, Math.round(size * 0.145)))
  const labelFontSize = Math.max(8, Math.min(11, Math.round(size / 12)))
  const labelPadding = Math.max(6, Math.round(size / 16))

  return (
    <div
      className={`relative flex items-end overflow-hidden shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: resolvedRadius,
        backgroundImage: `repeating-linear-gradient(135deg, ${STRIPE_LIGHT}, ${STRIPE_LIGHT} ${stripe}px, ${STRIPE_DARK} ${stripe}px, ${STRIPE_DARK} ${stripe * 2}px)`,
      }}
    >
      {showLabel && (
        <span
          className="font-mono-label text-text-3"
          style={{ fontSize: labelFontSize, padding: labelPadding }}
        >
          cover
        </span>
      )}
    </div>
  )
}
