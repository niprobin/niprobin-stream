import { X } from 'lucide-react'
import { useNotification } from '@/contexts/NotificationContext'

export function NotificationBanner() {
  const { notification, dismissNotification } = useNotification()

  if (!notification) {
    return null
  }

  const bgColor = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  }[notification.type]

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-[9999]
        ${bgColor} text-white text-sm font-medium
        py-3 px-4
        transform transition-all duration-150 ease-in-out
        ${notification ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
        flex items-center justify-between gap-4
      `}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="flex-1 text-center">{notification.message}</p>
      <button
        onClick={dismissNotification}
        className="flex-shrink-0 hover:bg-white/20 rounded-full p-1 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
