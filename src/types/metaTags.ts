/**
 * Meta Tag Types
 * TypeScript interfaces for Open Graph and meta tag configurations
 */

/**
 * Configuration for OpenGraph meta tags
 */
export interface OpenGraphConfig {
  title: string
  description: string
  image: string
  url: string
  type: 'music.song' | 'music.album' | 'website'
  siteName: string
}

/**
 * General meta tag configuration
 */
export interface MetaTagConfig {
  title: string
  description: string
  openGraph: OpenGraphConfig
  twitterCard?: {
    card: 'summary' | 'summary_large_image'
    title: string
    description: string
    image: string
  }
}

/**
 * Track-specific metadata for generating meta tags
 */
export interface TrackMetaData {
  title: string
  artist: string
  album?: string
  coverArt?: string
  deezer_id: string
}

/**
 * Album-specific metadata for generating meta tags
 */
export interface AlbumMetaData {
  title: string
  artist: string
  coverArt?: string
  albumId: number
  trackCount?: number
}

/**
 * Default site metadata configuration
 */
export interface DefaultMetaConfig {
  siteName: string
  defaultTitle: string
  defaultDescription: string
  defaultImage: string
  baseUrl: string
}