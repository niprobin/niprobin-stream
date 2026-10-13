import type { TrackFiles } from '@/playback/trackFiles'

// An in-memory stand-in for the Track Cache's in-memory files. Downloads
// succeed instantly unless the URL was marked as failing, and every file is
// `fileSize` bytes.
export function createMemoryTrackFiles({ fileSize = 100 } = {}) {
  // File name → the URL it was downloaded from
  const files = new Map<string, string>()
  const downloads: string[] = []
  const failingUrls = new Set<string>()

  const trackFiles: TrackFiles = {
    async find(name) {
      return files.has(name) ? `file:///cache/${name}` : null
    },
    async download(url, name) {
      downloads.push(url)
      if (failingUrls.has(url)) throw new Error('Download failed')
      files.set(name, url)
      return `file:///cache/${name}`
    },
    async list() {
      return [...files.keys()].map(name => ({ name, size: fileSize }))
    },
    async remove(name) {
      files.delete(name)
    },
  }

  return {
    trackFiles,
    // Every URL downloaded, in order
    downloads,
    // The URLs of the files on the phone now, in download order
    storedUrls: () => [...files.values()],
    failDownloadsFrom(url: string) {
      failingUrls.add(url)
    },
  }
}
