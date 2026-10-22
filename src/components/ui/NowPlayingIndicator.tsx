import { Volume2 } from 'lucide-react'

// Marks the playing track in a list: bouncing bars while it plays, a speaker
// while it's paused
export function NowPlayingIndicator({ isPlaying }: { isPlaying: boolean }) {
  if (!isPlaying) return <Volume2 className="h-4 w-4 text-accent" aria-label="Paused" />
  return (
    <span className="now-playing" role="img" aria-label="Playing">
      <span />
      <span />
      <span />
    </span>
  )
}

// The same marker over a cover, for rows that show art instead of a number
export function NowPlayingOverlay({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-sm-crate bg-black/55">
      <NowPlayingIndicator isPlaying={isPlaying} />
    </div>
  )
}
