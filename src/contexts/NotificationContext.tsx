import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'

type NotificationType = 'success' | 'error' | 'info'

// A button on the notification, such as Undo; pressing it dismisses the notification
type NotificationAction = { label: string; onClick: () => void }

type NotificationOptions = { action?: NotificationAction; durationMs?: number }

type Notification = {
  message: string
  type: NotificationType
  id: number
  action?: NotificationAction
}

const DEFAULT_DURATION_MS = 3500

type NotificationContextType = {
  notification: Notification | null
  showNotification: (message: string, type: NotificationType, options?: NotificationOptions) => void
  dismissNotification: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<Notification | null>(null)
  const timerRef = useRef<number | null>(null)

  const dismissNotification = useCallback(() => {
    setNotification(null)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const showNotification = useCallback((message: string, type: NotificationType, options: NotificationOptions = {}) => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Set new notification
    setNotification({ message, type, id: Date.now(), action: options.action })

    timerRef.current = window.setTimeout(() => {
      setNotification(null)
      timerRef.current = null
    }, options.durationMs ?? DEFAULT_DURATION_MS)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return (
    <NotificationContext.Provider value={{ notification, showNotification, dismissNotification }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}
