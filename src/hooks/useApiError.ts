import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'

/**
 * Hook for standardized API error handling
 * Provides consistent loading state management and error notification
 */
export function useApiError() {
  const { showNotification } = useNotification()
  const { increment, decrement } = useLoading()

  return {
    handleApiOperation: async <T>(
      operation: () => Promise<T>,
      errorMessage = 'Operation failed'
    ): Promise<T | null> => {
      increment()
      try {
        const result = await operation()
        return result
      } catch (error) {
        console.error(error)
        showNotification(errorMessage, 'error')
        return null
      } finally {
        decrement()
      }
    }
  }
}