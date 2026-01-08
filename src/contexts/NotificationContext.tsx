import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react'

type NotificationType = 'success' | 'error' | 'info'

type Notification = {
  message: string
  type: NotificationType
  id: number
}

type NotificationContextType = {
  notification: Notification | null
  showNotification: (message: string, type: NotificationType) => void
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

  const showNotification = useCallback((message: string, type: NotificationType) => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    // Set new notification
    setNotification({ message, type, id: Date.now() })

    // Auto-dismiss after 3500ms
    timerRef.current = window.setTimeout(() => {
      setNotification(null)
      timerRef.current = null
    }, 3500)
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
