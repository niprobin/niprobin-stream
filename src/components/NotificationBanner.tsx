import { X } from 'lucide-react'
import { useNotification } from '@/contexts/NotificationContext'

export function NotificationBanner() {
  const { notification, dismissNotification } = useNotification()

  if (!notification?.message) {
    return null
  }

  const styleMap = {
    success: {
      bg: 'bg-success-bg',
      border: 'border-success-border',
      dot: 'bg-success-dot',
      text: 'text-success-text',
    },
    error: {
      bg: 'bg-error-bg',
      border: 'border-error-border',
      dot: 'bg-error-dot',
      text: 'text-error-text',
    },
    info: {
      bg: 'bg-bg-2',
      border: 'border-border',
      dot: 'bg-accent',
      text: 'text-text-1',
    },
  }
  // Fall back to the neutral "info" look for any type value that doesn't
  // match a known key — API responses aren't guaranteed to send exactly
  // 'success'/'error' at runtime even though the type says so, and this
  // must never throw (an uncaught error here takes down the whole app,
  // with no error boundary to catch it).
  const styles = styleMap[notification.type] ?? styleMap.info

  return (
    <div
      className={`
        fixed top-4 left-4 right-4 z-[9999] mx-auto max-w-sm
        rounded-md-crate border ${styles.bg} ${styles.border}
        px-4 py-3
        flex items-center gap-3
        shadow-lg
        transition-all duration-150 ease-in-out
        translate-y-0 opacity-100
      `}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${styles.dot}`} />
      <p className={`flex-1 text-sm font-medium ${styles.text}`}>{notification.message}</p>
      <button
        onClick={dismissNotification}
        className={`flex-shrink-0 rounded-full p-1 transition-colors hover:bg-text-1/10 ${styles.text}`}
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
