/**
 * useMetaTags Hook
 * Custom hook for dynamically updating document head meta tags
 */

import { useCallback, useRef } from 'react'
import type { MetaTagConfig } from '../types/metaTags'
import { generateDefaultMetaTags } from '../utils/metaTagHelpers'

/**
 * Meta tag management hook for dynamic Open Graph and meta tag updates
 */
export function useMetaTags() {
  // Keep track of meta tags we've added so we can clean them up
  const addedTagsRef = useRef<HTMLMetaElement[]>([])

  /**
   * Remove all previously added meta tags
   */
  const clearMetaTags = useCallback(() => {
    addedTagsRef.current.forEach(tag => {
      if (tag.parentNode) {
        tag.parentNode.removeChild(tag)
      }
    })
    addedTagsRef.current = []
  }, [])

  /**
   * Create and add a meta tag to the document head
   */
  const createMetaTag = useCallback((property: string, content: string): HTMLMetaElement => {
    const meta = document.createElement('meta')

    // Handle different types of meta tags
    if (property.startsWith('og:') || property.startsWith('fb:')) {
      meta.setAttribute('property', property)
    } else if (property.startsWith('twitter:')) {
      meta.setAttribute('name', property)
    } else {
      meta.setAttribute('name', property)
    }

    meta.setAttribute('content', content)
    document.head.appendChild(meta)

    return meta
  }, [])

  /**
   * Update document title
   */
  const updateTitle = useCallback((title: string) => {
    document.title = title
  }, [])

  /**
   * Update meta description
   */
  const updateDescription = useCallback((description: string) => {
    // Find existing description tag or create new one
    let descriptionTag = document.querySelector('meta[name="description"]') as HTMLMetaElement
    if (descriptionTag) {
      descriptionTag.setAttribute('content', description)
    } else {
      descriptionTag = createMetaTag('description', description)
      addedTagsRef.current.push(descriptionTag)
    }
  }, [createMetaTag])

  /**
   * Set complete meta tag configuration
   */
  const setMetaTags = useCallback((config: MetaTagConfig) => {
    try {
      // Clear any previously set meta tags
      clearMetaTags()

      // Update document title
      updateTitle(config.title)

      // Update meta description
      updateDescription(config.description)

      // Add Open Graph tags
      const ogTags = [
        ['og:title', config.openGraph.title],
        ['og:description', config.openGraph.description],
        ['og:image', config.openGraph.image],
        ['og:url', config.openGraph.url],
        ['og:type', config.openGraph.type],
        ['og:site_name', config.openGraph.siteName]
      ]

      ogTags.forEach(([property, content]) => {
        if (content) {
          const tag = createMetaTag(property, content)
          addedTagsRef.current.push(tag)
        }
      })

      // Add Twitter Card tags if provided
      if (config.twitterCard) {
        const twitterTags = [
          ['twitter:card', config.twitterCard.card],
          ['twitter:title', config.twitterCard.title],
          ['twitter:description', config.twitterCard.description],
          ['twitter:image', config.twitterCard.image]
        ]

        twitterTags.forEach(([property, content]) => {
          if (content) {
            const tag = createMetaTag(property, content)
            addedTagsRef.current.push(tag)
          }
        })
      }
    } catch (error) {
      console.error('Failed to update meta tags:', error)
      // Fallback to default meta tags on error
      resetToDefault()
    }
  }, [clearMetaTags, updateTitle, updateDescription, createMetaTag])

  /**
   * Reset to default site meta tags
   */
  const resetToDefault = useCallback(() => {
    const defaultConfig = generateDefaultMetaTags()
    setMetaTags(defaultConfig)
  }, [setMetaTags])

  /**
   * Cleanup function to remove all added meta tags
   */
  const cleanup = useCallback(() => {
    clearMetaTags()
  }, [clearMetaTags])

  return {
    setMetaTags,
    resetToDefault,
    cleanup
  }
}