import type { AudioPlayer, PlayerTrack } from '@/playback/engine'

// An in-memory stand-in for the audio element: records what it was asked to
// play so tests can check what the listener would hear.
export function createFakePlayer() {
  const played: PlayerTrack[] = []
  let current: PlayerTrack | null = null

  const player: AudioPlayer = {
    async play(track) {
      played.push(track)
      current = track
    },
    async pause() {},
    async resume() {},
    async seekTo() {},
    async stop() {
      current = null
    },
  }

  return {
    player,
    // Every track handed to the player, in order
    played,
    // Titles of every track handed to the player, in order
    playedTitles: () => played.map(t => t.title),
    current: () => current,
  }
}
