import type { StreamDetails, StreamTrack } from '@/services/api'
import { createPlaybackEngine } from './engine'
import { createHtmlAudioPlayer } from './htmlAudioPlayer'
import { createTrackCache } from './trackCache'
import { createBrowserTrackFiles } from './trackFiles'

// The app's one playback engine. It lives outside React so the <audio>
// element's events and the OS media keys drive it directly.

export const audioElement = new Audio()

let token: string | null = null

// The session's token, for the /stream lookups made in the background
export function setPlaybackToken(value: string | null) {
  token = value
}

const trackCache = createTrackCache({
  files: createBrowserTrackFiles(),
  getToken: () => token,
  isOnline: () => navigator.onLine,
})

export const playbackEngine = createPlaybackEngine({ cache: trackCache, player: createHtmlAudioPlayer(audioElement) })

// What /stream said about a track the engine fetched
export function streamDetails(track: StreamTrack): StreamDetails | undefined {
  return trackCache.details(track)
}

// Logout: stops playback and releases every fetched file
export async function resetPlayback(): Promise<void> {
  await playbackEngine.stop()
  await trackCache.clear([])
}

audioElement.addEventListener('ended', () => {
  void playbackEngine.trackEnded()
})

if ('mediaSession' in navigator) {
  const session = navigator.mediaSession
  session.setActionHandler('play', () => {
    playbackEngine.resume().catch(() => {})
  })
  session.setActionHandler('pause', () => void playbackEngine.pause())
  session.setActionHandler('previoustrack', () => void playbackEngine.previous())
  session.setActionHandler('nexttrack', () => void playbackEngine.next())
  session.setActionHandler('seekbackward', () => {
    void playbackEngine.seekTo(Math.max(0, audioElement.currentTime - 10))
  })
  session.setActionHandler('seekforward', () => {
    void playbackEngine.seekTo(Math.min(audioElement.duration || 0, audioElement.currentTime + 10))
  })
  session.setActionHandler('seekto', details => {
    if (details.seekTime !== undefined) void playbackEngine.seekTo(details.seekTime)
  })
}
