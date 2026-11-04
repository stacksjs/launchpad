import { expect, test } from 'bun:test'
import {
  librarySearchScript, maxTrackResults, nowPlayingResults, parseNowPlaying,
  parseTracks, playTrackScript, trackResults,
} from '../resources/functions/music'

const line = (...fields: string[]) => fields.join('\t')

test('a stopped or closed player is simply nothing playing', () => {
  for (const output of ['stopped', '', '   ', 'something unexpected']) expect(parseNowPlaying(output)).toEqual({ state: 'stopped', track: null })
  // Music answers with its own state word; anything else is treated as stopped rather than guessed at.
  expect(parseNowPlaying(line('seeking', '1', 'Clair de Lune', 'Debussy', 'Suite'))).toEqual({ state: 'stopped', track: null })
})

test('what is playing is read back with its artist and album', () => {
  expect(parseNowPlaying(line('playing', '4231', 'Clair de Lune', 'Debussy', 'Suite Bergamasque'))).toEqual({
    state: 'playing',
    track: { id: '4231', name: 'Clair de Lune', artist: 'Debussy', album: 'Suite Bergamasque' },
  })
  expect(parseNowPlaying(line('paused', '7', 'Kind of Blue', 'Miles Davis', '')).state).toBe('paused')
  // A track Music could not describe is not worth a row, and an ID that is not a number could not be played back.
  expect(parseNowPlaying(line('playing', 'abc', 'Name', 'Artist', 'Album')).track).toBeNull()
  expect(parseNowPlaying(line('playing', '12', '', 'Artist', 'Album')).track).toBeNull()
})

test('nothing playing earns no row, and a loaded track says which state it is in', () => {
  expect(nowPlayingResults({ state: 'stopped', track: null })).toEqual([])
  const track = { id: '4231', name: 'Clair de Lune', artist: 'Debussy', album: 'Suite Bergamasque' }
  expect(nowPlayingResults({ state: 'playing', track })[0]).toMatchObject({
    title: 'Clair de Lune', subtitle: 'Now playing · Debussy · Suite Bergamasque', content: 'music-play-pause',
  })
  expect(nowPlayingResults({ state: 'paused', track })[0]!.subtitle).toBe('Paused · Debussy · Suite Bergamasque')
  // The row runs the same play or pause command as typing it, so it goes through the fixed system command list.
  expect(nowPlayingResults({ state: 'playing', track })[0]!.kind).toBe('system')
  // An empty album leaves no trailing separator behind.
  expect(nowPlayingResults({ state: 'playing', track: { ...track, album: '' } })[0]!.subtitle).toBe('Now playing · Debussy')
})

test('a library search is built only for a query worth running', () => {
  for (const query of ['', ' ', 'a', ' x ', 'a'.repeat(101)]) expect(librarySearchScript(query)).toBeNull()
  const script = librarySearchScript('blue')
  expect(script).toContain('every track whose name contains "blue"')
  expect(script).toContain(`if total > ${maxTrackResults}`)
  // A name with a quote or a backslash can never end the literal and add code of its own.
  expect(librarySearchScript('a"b\\c')).toContain('contains "a\\"b\\\\c"')
  expect(librarySearchScript('a"b\\c')).not.toContain('${')
})

test('tracks that cannot be played back are dropped', () => {
  const output = [
    line('4231', 'Clair de Lune', 'Debussy', 'Suite Bergamasque'),
    line('notanumber', 'Ignored', 'Artist', 'Album'),
    line('9', '', 'Artist', 'Album'),
    line('77', 'So What', 'Miles Davis', 'Kind of Blue'),
  ].join('\n')
  expect(parseTracks(output).map(track => track.id)).toEqual(['4231', '77'])
})

test('a library listing is bounded and every row carries the ID that plays it', () => {
  const many = Array.from({ length: maxTrackResults + 10 }, (_, index) => ({ id: String(index + 1), name: `Track ${index}`, artist: 'A', album: 'B' }))
  expect(trackResults(many)).toHaveLength(maxTrackResults)
  expect(trackResults(many)[0]).toMatchObject({ key: 'music:track:1', kind: 'music', content: '1', subtitle: 'Music · A · B' })
})

test('only a plain number ever reaches a play script', () => {
  expect(playTrackScript('4231')).toContain('database ID is 4231')
  for (const bad of ['', 'abc', '1; delete', '-1', '1.5', '0'.repeat(20), '4231 ']) expect(playTrackScript(bad)).toBeNull()
})
