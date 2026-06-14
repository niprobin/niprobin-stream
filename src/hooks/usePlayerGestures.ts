import { useEffect, useRef } from 'react'

interface GestureHandlers {
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onDragX?: (deltaX: number) => void
  onDragY?: (deltaY: number) => void
  onDragEnd?: () => void
}

interface GestureConfig {
  minSwipeDistance?: number
}

export function usePlayerGestures(
  ref: React.RefObject<HTMLElement>,
  handlers: GestureHandlers,
  config: GestureConfig = {}
): void {
  const { minSwipeDistance = 40 } = config
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const axisLock = useRef<'x' | 'y' | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStart.current = { x: touch.clientX, y: touch.clientY }
      axisLock.current = null
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStart.current) return
      const touch = e.touches[0]
      const deltaX = touchStart.current.x - touch.clientX
      const deltaY = touchStart.current.y - touch.clientY

      // Lock to dominant axis after 8px of movement
      if (!axisLock.current) {
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
          axisLock.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y'
        }
        return
      }

      if (axisLock.current === 'x') {
        handlersRef.current.onDragX?.(deltaX)
      } else {
        handlersRef.current.onDragY?.(deltaY)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return
      handlersRef.current.onDragEnd?.()

      const touch = e.changedTouches[0]
      const diffX = touchStart.current.x - touch.clientX
      const diffY = touchStart.current.y - touch.clientY
      const absDiffX = Math.abs(diffX)
      const absDiffY = Math.abs(diffY)
      touchStart.current = null
      axisLock.current = null

      if (absDiffY >= minSwipeDistance && absDiffY > absDiffX) {
        e.preventDefault()
        navigator.vibrate?.(30)
        if (diffY > 0) handlersRef.current.onSwipeUp?.()
        else handlersRef.current.onSwipeDown?.()
      } else if (absDiffX >= minSwipeDistance && absDiffX > absDiffY) {
        e.preventDefault()
        navigator.vibrate?.([30, 50, 30])
        if (diffX > 0) handlersRef.current.onSwipeLeft?.()
        else handlersRef.current.onSwipeRight?.()
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [ref, minSwipeDistance])
}
