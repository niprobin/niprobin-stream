import type { AudioPlayer } from './engine'

// The engine's player, over an <audio> element. Also tells the OS what's
// playing (Media Session), for its media overlay and hardware media keys.
export function createHtmlAudioPlayer(audio: HTMLAudioElement): AudioPlayer {
  return {
    async play(track) {
      audio.src = track.uri
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          artwork: track.artworkUrl ? [{ src: track.artworkUrl, sizes: '512x512' }] : [],
        })
      }
      // Rejects when the file can't be decoded, which the engine reports
      await audio.play()
    },
    async pause() {
      audio.pause()
    },
    async resume() {
      await audio.play()
    },
    async seekTo(seconds) {
      audio.currentTime = seconds
    },
    async stop() {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
    },
  }
}
