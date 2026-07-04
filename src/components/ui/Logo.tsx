import logoSrc from '@/assets/nipstream-logo.png'

interface LogoProps {
  /** Diameter in px. Common call sites: 34 (header), 56 (login), 38 (avatar). */
  size?: number
  className?: string
}

/** Circular nipstream brand mark. Always rendered as a circle, never a square. */
export function Logo({ size = 34, className = '' }: LogoProps) {
  return (
    <img
      src={logoSrc}
      alt="nipstream"
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
