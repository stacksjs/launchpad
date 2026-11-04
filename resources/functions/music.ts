import { appleScriptString, cleanField, parseRecords } from './applescript'
import type { Result } from './search'

/**
 * Reading from the system music app: what is playing now, and what is in the library. The transport commands live with
 * the other fixed system commands; this is the half that asks Music a question and turns the answer into rows.
 *
 * A track name is quoted before it reaches AppleScript, and a track is played back by its database ID, which is a
 * number Music assigns. Nothing a person types is ever concatenated into a script.
 */
export interface Track { id: string, name: string, artist: string, album: string }
export type PlayerState = 'playing' | 'paused' | 'stopped'
export interface NowPlaying { state: PlayerState, track: Track | null }

/** A library can hold tens of thousands of tracks, and nobody reads past the first screen of matches. */
export const maxTrackResults = 20

/**
 * What Music is doing. `application "Music" is running` answers without starting it, so opening the palette never
 * launches a music player at someone who did not ask for one.
 */
// `playing` and `paused` are player-state constants inside a Music tell block, so the variable holding the answer has
// to be named something Music does not already define.
export const nowPlayingScript = `if not (application "Music" is running) then return "stopped"
tell application "Music"
  set stateText to player state as text
  if stateText is not "playing" and stateText is not "paused" then return "stopped"
  set t to current track
  return stateText & tab & (database ID of t) & tab & (name of t) & tab & (artist of t) & tab & (album of t)
end tell`

export function parseNowPlaying(output: string): NowPlaying {
  const [record] = parseRecords(output, 5)
  if (!record) return { state: 'stopped', track: null }
  const [state, id, name, artist, album] = record
  if (state !== 'playing' && state !== 'paused') return { state: 'stopped', track: null }
  const track = { id: cleanField(id), name: cleanField(name), artist: cleanField(artist), album: cleanField(album) }
  if (!/^\d+$/.test(track.id) || !track.name) return { state: 'stopped', track: null }
  return { state, track }
}

/** A line describing what the artist and album add, skipping whichever Music left empty. */
function describe(track: Track, lead: string): string {
  return [lead, track.artist, track.album].filter(Boolean).join(' · ')
}

/** One row, and only while something is loaded. A stopped player has nothing worth a line in the list. */
export function nowPlayingResults(playing: NowPlaying): Result[] {
  if (!playing.track) return []
  const lead = playing.state === 'playing' ? 'Now playing' : 'Paused'
  return [{
    key: 'music:now-playing',
    title: playing.track.name,
    subtitle: describe(playing.track, lead),
    kind: 'system',
    content: 'music-play-pause',
    searchAliases: ['now playing', 'current track', 'what is playing', 'music'],
    searchText: `${playing.track.artist} ${playing.track.album}`,
  }]
}

/** Searching the library starts Music, which is fair for someone looking for something to play. Null for a query too short to be worth it. */
export function librarySearchScript(query: string): string | null {
  const text = query.trim()
  if (text.length < 2 || text.length > 100) return null
  return `tell application "Music"
  set output to ""
  set matches to (every track whose name contains ${appleScriptString(text)})
  set total to count of matches
  if total > ${maxTrackResults} then set total to ${maxTrackResults}
  repeat with i from 1 to total
    set t to item i of matches
    set output to output & (database ID of t) & tab & (name of t) & tab & (artist of t) & tab & (album of t) & linefeed
  end repeat
  return output
end tell`
}

export function parseTracks(output: string): Track[] {
  return parseRecords(output, 4).flatMap(([id, name, artist, album]) => {
    const track = { id: cleanField(id), name: cleanField(name), artist: cleanField(artist), album: cleanField(album) }
    return /^\d+$/.test(track.id) && track.name ? [track] : []
  })
}

export function trackResults(tracks: readonly Track[]): Result[] {
  return tracks.slice(0, maxTrackResults).map(track => ({
    key: `music:track:${track.id}`,
    title: track.name,
    subtitle: describe(track, 'Music'),
    kind: 'music',
    content: track.id,
    searchText: `${track.artist} ${track.album}`,
  }))
}

/** Play one track by the ID Music gave it. A value that is not a plain number never reaches a script. */
export function playTrackScript(id: string): string | null {
  if (!/^\d{1,19}$/.test(id)) return null
  return `tell application "Music"
  activate
  play (first track whose database ID is ${id})
end tell`
}
