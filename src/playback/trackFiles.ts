export type StoredFile = { name: string; size: number }

// Where the Track Cache keeps its files. The cache only needs these
// operations, so tests can swap in a fake.
export type TrackFiles = {
  // The playable URI of a stored file, or null when it isn't stored
  find(name: string): Promise<string | null>
  // Downloads `url` into a stored file and returns its playable URI. A failed
  // download throws and leaves nothing behind under `name`.
  download(url: string, name: string): Promise<string>
  // The files stored, with their size in bytes
  list(): Promise<StoredFile[]>
  remove(name: string): Promise<void>
}

// The file server only allows the production origin, so in dev its files go
// through Vite's proxy (see vite.config.ts)
function fetchableUrl(url: string): string {
  return import.meta.env.DEV ? url.replace('https://files.niprobin.com', '/files-proxy') : url
}

// Files live in memory as Blobs, played from object URLs: nothing survives a
// reload, and removing a file releases its memory.
export function createBrowserTrackFiles(): TrackFiles {
  const files = new Map<string, { uri: string; size: number }>()

  return {
    async find(name) {
      return files.get(name)?.uri ?? null
    },
    async download(url, name) {
      const response = await fetch(fetchableUrl(url))
      if (!response.ok) throw new Error(`Download failed: ${response.status}`)
      const blob = await response.blob()
      const previous = files.get(name)
      if (previous) URL.revokeObjectURL(previous.uri)
      const uri = URL.createObjectURL(blob)
      files.set(name, { uri, size: blob.size })
      return uri
    },
    async list() {
      return [...files].map(([name, file]) => ({ name, size: file.size }))
    },
    async remove(name) {
      const file = files.get(name)
      if (!file) return
      URL.revokeObjectURL(file.uri)
      files.delete(name)
    },
  }
}
