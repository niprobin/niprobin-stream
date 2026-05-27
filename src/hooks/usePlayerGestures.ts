import { useEffect, useRef } from 'react'

interface GestureHandlers {
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

interface GestureConfig {
  minSwipeDistance?: number
  horizontalTolerance?: number
  verticalTolerance?: number
}

export function usePlayerGestures(
  ref: React.RefObject<HTMLElement>,
  handlers: GestureHandlers,
  config: GestureConfig = {}
): void {
  const { minSwipeDistance = 40, horizontalTolerance = 20, verticalTolerance = 20 } = config
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return
      const touch = e.changedTouches[0]
      const diffX = touchStart.current.x - touch.clientX
      const diffY = touchStart.current.y - touch.clientY
      const absDiffX = Math.abs(diffX)
      const absDiffY = Math.abs(diffY)
      touchStart.current = null

      if (absDiffY >= minSwipeDistance && absDiffX <= horizontalTolerance) {
        e.preventDefault()
        navigator.vibrate?.(30)
        if (diffY > 0) handlersRef.current.onSwipeUp?.()
        else handlersRef.current.onSwipeDown?.()
      } else if (absDiffX >= minSwipeDistance && absDiffY <= verticalTolerance) {
        e.preventDefault()
        navigator.vibrate?.([30, 50, 30])
        if (diffX > 0) handlersRef.current.onSwipeLeft?.()
        else handlersRef.current.onSwipeRight?.()
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [ref, minSwipeDistance, horizontalTolerance, verticalTolerance])
}
