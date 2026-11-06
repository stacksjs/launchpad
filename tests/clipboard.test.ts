import { expect, test } from 'bun:test'
import { clipboardDecision, clipboardResult, clipboardResults, clipboardSelection, clipboardSummary, clipboardTime, clipboardTitle, clipboardWithSources, clipboardSources, clipboardSnippetTitle, maxClipboardText } from '../resources/functions/clipboard'

test('only usable text within the model limit is saved', () => {
  expect(clipboardDecision('copied')).toBe('save')
  expect(clipboardDecision('x'.repeat(maxClipboardText))).toBe('save')
  expect(clipboardDecision('x'.repeat(maxClipboardText + 1))).toBe('too-large')
  for (const text of [undefined, null, '', ' \n\t ']) expect(clipboardDecision(text)).toBe('empty')
})

test('clipboard titles are one clean line that never splits an emoji', () => {
  expect(clipboardTitle('\n\n  first   line\nsecond')).toBe('first line second')
  const title = clipboardTitle('😀'.repeat(150))
  expect(Array.from(title)).toHaveLength(100)
  expect(title).toBe('😀'.repeat(100))
  expect(clipboardTitle('')).toBe('')
})

const copied = (id: number, capturedAt = 0, content = `Copy ${id}`) => clipboardResult({ id, capturedAt, content })

test('history keeps capture time and source across native API field formats, including older rows', () => {
  const stamp = Date.now()
  expect(clipboardResult({ id: 1, content: 'one', capturedAt: stamp, sourceApp: 'com.apple.Safari' })).toMatchObject({ capturedAt: stamp, sourceApp: 'com.apple.Safari', subtitle: 'Clipboard · Safari' })
  expect(clipboardResult({ id: 2, content: 'two', captured_at: String(stamp), source_app: 'com.apple.Notes' })).toMatchObject({ capturedAt: stamp, sourceApp: 'com.apple.Notes' })
  expect(clipboardResult({ id: 3, content: 'old', capturedAt: 0, created_at: new Date(stamp).toISOString() }).capturedAt).toBe(stamp)
  for (const value of [0, '0', -1, 'invalid', Infinity, NaN, 1e20]) expect(clipboardResult({ id: 4, content: 'unknown', capturedAt: value }).capturedAt).toBe(0)
})

test('history is newest first independent of API order, title, favorites and launch frequency', () => {
  const rows = [copied(1, 10, 'Alpha'), { ...copied(2, 20, 'Beta'), favorite: true, launches: 999, lastUsed: Date.now() }, copied(3, 30, 'Zulu')]
  expect(clipboardResults(rows).map(row => row.id)).toEqual([3, 2, 1])
  expect(clipboardResults([...rows].reverse()).map(row => row.id)).toEqual([3, 2, 1])
  expect(rows.map(row => row.id)).toEqual([1, 2, 3])
})

test('simultaneous and legacy copies have a stable newest ID tie breaker', () => {
  expect(clipboardResults([copied(9, 12), copied(10, 12), copied(3), copied(4)]).map(row => row.id)).toEqual([10, 9, 4, 3])
})

test('history search covers the entire text and source, preserves chronology and folds accents', () => {
  const rows = [copied(1, 1, 'Résumé old'), copied(2, 2, 'z'.repeat(400) + '\nRésumé launch checklist'), clipboardResult({ id: 3, content: 'other', capturedAt: 3, sourceApp: 'com.apple.Safari' })]
  expect(clipboardResults(rows, 'resume').map(row => row.id)).toEqual([2, 1])
  expect(clipboardResults(rows, 'CHECKLIST resume').map(row => row.id)).toEqual([2])
  expect(clipboardResults(rows, 'safari').map(row => row.id)).toEqual([3])
  expect(clipboardResults(rows, 'missing')).toEqual([])
  expect(clipboardResults([{ ...copied(4), kind: 'snippet' }])).toEqual([])
})

test('copy dates show local today, yesterday and an older date without inventing missing times', () => {
  const now = new Date(2026, 10, 5, 14, 30).getTime()
  expect(clipboardTime(now, now)).toStartWith('Today · ')
  expect(clipboardTime(new Date(2026, 10, 4, 23, 30).getTime(), now)).toStartWith('Yesterday · ')
  expect(clipboardTime(new Date(2025, 10, 3, 10).getTime(), now)).toContain('2025')
  for (const stamp of [undefined, 0, NaN, Infinity]) expect(clipboardTime(stamp, now)).toBe('Copy time unavailable')
})

test('preview counts characters and different line endings correctly', () => {
  expect(clipboardSummary('😀')).toBe('1 character · 1 line')
  expect(clipboardSummary('a\r\nb\rc\nd')).toBe('8 characters · 4 lines')
})

test('live history follows newest at the top and preserves the entry being reviewed below it', () => {
  const next = [copied(4), copied(3), copied(2), copied(1)]
  expect(clipboardSelection(copied(3), 0, next)).toBe(0)
  expect(clipboardSelection(copied(2), 1, next)).toBe(2)
  expect(clipboardSelection(copied(3), 0, next, true)).toBe(1)
  expect(clipboardSelection(copied(8), 3, next.slice(0, 2))).toBe(1)
  expect(clipboardSelection(copied(8), 3, [])).toBe(0)
})


test('source filters resolve installed app identities and search their display names', () => {
  const apps = [{ key: '/Code.app', title: 'Visual Studio Code', subtitle: 'Application', content: '/Code.app', kind: 'application', bundleId: 'com.microsoft.VSCode' }]
  const entries = [clipboardResult({ id: 1, content: 'Editor text', sourceApp: 'com.microsoft.VSCode' }), clipboardResult({ id: 2, content: 'Browser text', sourceApp: 'com.apple.Safari' }), copied(3)]
  const rows = clipboardWithSources([...apps, ...entries])
  expect(rows[0]).toBe(apps[0])
  expect(rows[1]).toMatchObject({ sourceAppName: 'Visual Studio Code', sourceAppPath: '/Code.app' })
  expect(rows[2]).toMatchObject({ sourceAppName: 'Safari', sourceAppPath: '' })
  expect(rows[3]).toMatchObject({ sourceAppName: 'Unknown source', sourceAppPath: '' })
  expect(clipboardResults(rows, 'studio', 'com.microsoft.VSCode').map(row => row.id)).toEqual([1])
  expect(clipboardResults(rows, '', '').map(row => row.id)).toEqual([3])
  expect(clipboardResults(rows, 'editor', 'com.apple.Safari')).toEqual([])
  expect(clipboardSources(rows)).toEqual([
    { id: 'com.apple.Safari', title: 'Safari', path: '', count: 1 },
    { id: '', title: 'Unknown source', path: '', count: 1 },
    { id: 'com.microsoft.VSCode', title: 'Visual Studio Code', path: '/Code.app', count: 1 },
  ])
})


test('clipboard snippet names obey the command model limit without splitting emoji', () => {
  expect(clipboardSnippetTitle('😀'.repeat(100))).toBe('😀'.repeat(60))
  expect(clipboardSnippetTitle('a' + '😀'.repeat(100))).toBe('a' + '😀'.repeat(59))
  expect(clipboardSnippetTitle('Saved\ntext')).toBe('Saved text')
  expect(clipboardSnippetTitle('   ')).toBe('Clipboard snippet')
})
