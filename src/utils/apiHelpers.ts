/**
 * API Helper Utilities
 * Shared functions for parsing and handling API responses
 */

export type ApiResponse = {
  status: 'success' | 'error'
  message: string
}

export type ParseOptions = {
  successMessage?: string
  errorMessage?: string
}

/**
 * Parse an API response into a standardized format
 * Handles various response formats from n8n webhooks
 */
export function parseApiResponse(
  response: Response,
  rawBody: string,
  options?: ParseOptions
): ApiResponse {
  let data: unknown = null

  // Try to parse JSON from response body
  if (rawBody) {
    try {
      data = JSON.parse(rawBody)
    } catch {
      data = null
    }
  }

  // Normalize status field
  const normalizeStatus = (): 'success' | 'error' => {
    if (data && typeof data === 'object' && data !== null) {
      const candidate = (data as Record<string, unknown>).status
      if (typeof candidate === 'string') {
        const lowered = candidate.toLowerCase()
        if (lowered === 'success') return 'success'
        if (lowered === 'error' || lowered === 'failed' || lowered === 'fail') return 'error'
      }

      // Check for boolean success field
      const successField = (data as Record<string, unknown>).success
      if (typeof successField === 'boolean') {
        return successField ? 'success' : 'error'
      }

      // Check for boolean error field
      const errorField = (data as Record<string, unknown>).error
      if (typeof errorField === 'boolean') {
        return errorField ? 'error' : 'success'
      }
    }

    // Fall back to HTTP status
    return response.ok ? 'success' : 'error'
  }

  // Extract message from various possible fields
  const extractMessage = (): string | null => {
    const tryFields = (fields: string[]): string | null => {
      if (!data || typeof data !== 'object' || data === null) return null
      for (const field of fields) {
        const value = (data as Record<string, unknown>)[field]
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim()
        }
      }
      return null
    }

    // Try common message fields first
    const prioritized = tryFields(['message', 'msg', 'detail', 'error', 'statusText'])
    if (prioritized) return prioritized

    // If data itself is a string, use it
    if (typeof data === 'string' && data.trim().length > 0) {
      return data.trim()
    }

    // Try to find any string value in the object
    if (data && typeof data === 'object') {
      const fallbackValue = Object.values(data).find(
        (value) => typeof value === 'string' && value.trim().length > 0,
      )
      if (typeof fallbackValue === 'string') {
        return fallbackValue.trim()
      }
    }

    // Last resort: use raw body
    if (rawBody && rawBody.trim().length > 0) {
      return rawBody.trim()
    }

    return null
  }

  const status = normalizeStatus()
  const extractedMessage = extractMessage()

  // Use extracted message or fall back to provided defaults
  const message =
    extractedMessage ||
    (status === 'success'
      ? options?.successMessage || 'Action completed'
      : options?.errorMessage || 'Action failed')

  return { status, message }
}
