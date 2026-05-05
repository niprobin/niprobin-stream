/**
 * Meta Tag Helper Utilities
 * Functions for generating meta tag configurations from track and album data
 */

import type { MetaTagConfig, TrackMetaData, AlbumMetaData, DefaultMetaConfig } from '../types/metaTags'

/**
 * Default configuration for the site
 */
const DEFAULT_CONFIG: DefaultMetaConfig = {
  siteName: 'nipstream',
  defaultTitle: 'nipstream – music streaming',
  defaultDescription: 'Discover and stream music on nipstream',
  defaultImage: '/android-chrome-512x512.png',
  baseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://stream.niprobin.com'
}

/**
 * Sanitize text for use in HTML attributes
 * @param text - Text to sanitize
 * @returns Sanitized text safe for HTML attributes
 */
function sanitizeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Get the full canonical URL for a resource
 * @param path - The path (e.g., '/play/abc123' or '/album/456')
 * @returns Full canonical URL
 */
function getCanonicalUrl(path: string): string {
  const baseUrl = DEFAULT_CONFIG.baseUrl
  return `${baseUrl}${path}`
}

/**
 * Get a fallback image URL if the provided image is invalid or missing
 * @param imageUrl - The original image URL
 * @returns Valid image URL or fallback
 */
function getFallbackImage(imageUrl?: string): string {
  if (!imageUrl || imageUrl.trim() === '') {
    return `${DEFAULT_CONFIG.baseUrl}${DEFAULT_CONFIG.defaultImage}`
  }

  // If it's a relative URL, make it absolute
  if (imageUrl.startsWith('/')) {
    return `${DEFAULT_CONFIG.baseUrl}${imageUrl}`
  }

  return imageUrl
}

/**
 * Generate meta tag configuration for a track
 * @param track - Track metadata
 * @returns Complete meta tag configuration
 */
export function generateTrackMetaTags(track: TrackMetaData): MetaTagConfig {
  const title = sanitizeForHtml(`${track.title} by ${track.artist}`)
  const description = sanitizeForHtml(`Listen to ${track.title} by ${track.artist} on nipstream`)
  const image = getFallbackImage(track.coverArt)
  const url = getCanonicalUrl(`/track/${track.deezer_id}`)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      image,
      url,
      type: 'music.song',
      siteName: DEFAULT_CONFIG.siteName
    },
    twitterCard: {
      card: 'summary_large_image',
      title,
      description,
      image
    }
  }
}

/**
 * Generate meta tag configuration for an album
 * @param album - Album metadata
 * @returns Complete meta tag configuration
 */
export function generateAlbumMetaTags(album: AlbumMetaData): MetaTagConfig {
  const title = sanitizeForHtml(`${album.title} by ${album.artist}`)

  let description = `${album.title} by ${album.artist} on nipstream`
  if (album.trackCount && album.trackCount > 0) {
    description = `${album.trackCount} tracks from ${album.title} by ${album.artist} on nipstream`
  }
  description = sanitizeForHtml(description)

  const image = getFallbackImage(album.coverArt)
  const url = getCanonicalUrl(`/album/${album.albumId}`)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      image,
      url,
      type: 'music.album',
      siteName: DEFAULT_CONFIG.siteName
    },
    twitterCard: {
      card: 'summary_large_image',
      title,
      description,
      image
    }
  }
}

/**
 * Generate default site meta tag configuration
 * @returns Default meta tag configuration
 */
export function generateDefaultMetaTags(): MetaTagConfig {
  return {
    title: DEFAULT_CONFIG.defaultTitle,
    description: DEFAULT_CONFIG.defaultDescription,
    openGraph: {
      title: DEFAULT_CONFIG.defaultTitle,
      description: DEFAULT_CONFIG.defaultDescription,
      image: `${DEFAULT_CONFIG.baseUrl}${DEFAULT_CONFIG.defaultImage}`,
      url: DEFAULT_CONFIG.baseUrl,
      type: 'website',
      siteName: DEFAULT_CONFIG.siteName
    },
    twitterCard: {
      card: 'summary_large_image',
      title: DEFAULT_CONFIG.defaultTitle,
      description: DEFAULT_CONFIG.defaultDescription,
      image: `${DEFAULT_CONFIG.baseUrl}${DEFAULT_CONFIG.defaultImage}`
    }
  }
}

/**
 * Build canonical URL for track sharing
 * @param deezer_id - Deezer track ID
 * @returns Full canonical URL
 */
export function buildCanonicalTrackUrl(deezer_id: string): string {
  return getCanonicalUrl(`/track/${deezer_id}`)
}

/**
 * Build canonical URL for album sharing
 * @param albumId - Album ID
 * @returns Full canonical URL
 */
export function buildCanonicalAlbumUrl(albumId: number): string {
  return getCanonicalUrl(`/album/${albumId}`)
}