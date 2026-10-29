// What the listener reads after a digging action, shared word for word by both
// nipstream apps (copied as PWA ADR 0001 describes). Server text is never shown
// here: only a refusal's own `message` (see webhook.ts) replaces these.

export function ratingLabel(rating: number): string {
  return rating === 1 ? '1 star' : `${rating} stars`
}

export const MESSAGES = {
  offline: "You're offline",
  // A Hide whose undo window ended with no connection
  hideNotSent: "You're offline: the Hide wasn't sent",

  picked: (playlist: string) => `Picked for ${playlist}`,
  moved: (playlist: string) => `Moved to ${playlist}`,
  pickFailed: "Couldn't Pick this track",

  hidden: 'Hidden',
  hideTrackFailed: "Couldn't Hide this track",
  hideAlbumFailed: "Couldn't Hide this album",

  rated: (rating: number) => `Rated ${ratingLabel(rating)}`,
  rateFailed: "Couldn't Rate this album",

  shortlisted: 'Shortlisted to Listen to',
  shortlistFailed: "Couldn't Shortlist this album",

  added: 'Added to the Album Backlog',
  addFailed: "Couldn't Add this album",

  addingToJellyfin: 'Adding to Jellyfin',
  addToJellyfinFailed: "Couldn't Add this album to Jellyfin",
} as const
