import type { FilterParams } from '@/utils/urlBuilder'

export function extractDeezerIdFromPath(path: string): string | null {
  const match = path.match(/^\/track\/(\d+)$/)
  return match ? match[1] : null
}

export function extractAlbumIdFromPath(path: string): number | null {
  const match = path.match(/^\/album\/(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

export function parsePageFromUrl(url?: string): number {
  if (!url) return 1
  try {
    const searchParams = url.includes('?')
      ? new URLSearchParams(url.split('?')[1])
      : new URLSearchParams(url)
    const pageParam = searchParams.get('page')
    if (!pageParam) return 1
    const pageNumber = parseInt(pageParam, 10)
    return isNaN(pageNumber) || pageNumber < 1 ? 1 : pageNumber
  } catch {
    return 1
  }
}

// Reads current window.location to determine which n8n context to pass to stream endpoint
export function getStreamContext(): string {
  if (typeof window === 'undefined') return 'search'
  const path = window.location.pathname
  if (path === '/library') return 'library'
  if (path === '/digging' || path.startsWith('/digging/')) return 'digging'
  if (path.startsWith('/album/')) return 'album'
  return 'search'
}

export function parseFiltersFromUrl(search: string): FilterParams {
  const params = new URLSearchParams(search)
  return {
    page: Math.max(1, parseInt(params.get('page') || '1', 10) || 1),
    curator: params.get('curator') || 'all',
    search: params.get('search') || '',
    folder: params.get('folder') || 'all',
    type: (params.get('type') as 'tracks' | 'albums') || 'tracks',
  }
}
