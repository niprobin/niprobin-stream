import { MESSAGES } from '@/api/actionMessages'
import { settleAction, type ActionResult } from '@/api/webhook'
import { followArtist, getFollowedArtists, unfollowArtist } from '@/services/api'

// Follow and stop following an artist, settled as the native client does: an
// action n8n didn't answer for is checked against followed-artists.

export type ArtistRef = { name: string; deezer_id: string }

// Whether the server lists the artist as Followed; throws when it can't say
export async function isFollowed(deezerId: string, token: string | null): Promise<boolean> {
  const artists = await getFollowedArtists(token)
  return artists.some(artist => String(artist.deezer_id) === deezerId)
}

export async function follow(artist: ArtistRef, token: string | null): Promise<ActionResult> {
  const outcome = await followArtist({ artist: artist.name, deezer_id: artist.deezer_id }, token)
  return settleAction(outcome, MESSAGES.followFailed, () => isFollowed(artist.deezer_id, token))
}

export async function unfollow(artist: ArtistRef, token: string | null): Promise<ActionResult> {
  const outcome = await unfollowArtist({ artist: artist.name, deezer_id: artist.deezer_id }, token)
  return settleAction(outcome, MESSAGES.unfollowFailed, async () => !(await isFollowed(artist.deezer_id, token)))
}
