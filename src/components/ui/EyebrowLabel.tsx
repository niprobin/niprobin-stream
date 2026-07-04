import type { HTMLAttributes, ReactNode } from 'react'

interface EyebrowLabelProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
}

/**
 * Small uppercase JetBrains Mono label used for eyebrows, timestamps,
 * and tags like "NOW PLAYING" / "COVER".
 */
export function EyebrowLabel({ children, className = '', ...props }: EyebrowLabelProps) {
  return (
    <span
      className={`font-mono-label uppercase tracking-[0.14em] text-text-3 ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
