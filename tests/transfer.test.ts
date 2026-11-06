import { expect, test } from 'bun:test'
import {
  buildDocument,
  carriedPreferences,
  describePlan,
  describeDifference,
  describeReport,
  documentName,
  documentVersion,
  folderPath,
  planMerge,
  readDocument,
  readTransferSettings,
  resolveMerge,
  serializeDocument,
} from '../resources/functions/transfer'
import type { TransferSource } from '../resources/functions/transfer'

const empty: TransferSource = { commands: [], themes: [], extensions: [], preferences: [], favorites: [] }
const at = new Date('2026-11-05T09:30:00.000Z')
const build = (source: Partial<TransferSource>) => buildDocument({ ...empty, ...source }, { version: '1.1.3', at })

const docs = { title: 'Docs', kind: 'quicklink' as const, content: 'https://example.com/?q={query}', alias: 'docs', shortcut: '' }
const signature = { title: 'Signature', kind: 'snippet' as const, content: 'Kind regards', alias: 'sig', shortcut: '⌘⌥S' }
const midnight = { name: 'Midnight', light: '{"ink":"#000"}', dark: '{"ink":"#fff"}', font: '' }

test('a document round-trips through text unchanged', () => {
  const document = build({ commands: [docs, signature], themes: [midnight] })
  const read = readDocument(serializeDocument(document))
  expect(read.ok).toBe(true)
  expect(read.ok && read.document).toEqual(document)
  expect(document.version).toBe(documentVersion)
  expect(document.exportedAt).toBe('2026-11-05T09:30:00.000Z')
})

test('clipboard text, launch counts and uncarried preferences never reach the file', () => {
  const document = build({
    favorites: [
      { key: '/Applications/Mail.app', favorite: true, aliases: 'post', launches: 97, lastUsed: 1762330000000 },
      // Nothing but a launch count: the row exists only because the app was opened.
      { key: '/Applications/Safari.app', favorite: false, aliases: '', launches: 412, lastUsed: 1762331000000 },
    ],
    preferences: [
      { key: 'appearance', value: 'dark' },
      { key: 'usage', value: '{"enabled":true}' },
      { key: 'loginInitialized', value: 'true' },
      { key: 'pantryCatalog', value: '94' },
    ],
  })
  expect(document.favorites).toEqual([{ key: '/Applications/Mail.app', favorite: true, aliases: 'post' }])
  expect(JSON.stringify(document)).not.toContain('launches')
  expect(JSON.stringify(document)).not.toContain('lastUsed')
  expect(document.preferences).toEqual([{ key: 'appearance', value: 'dark' }])
  // Recording is opt-in per Mac, so the choice is not something the file carries.
  expect(carriedPreferences).not.toContain('usage')
})

test('a merge adds what is missing and leaves what already matches', () => {
  const plan = planMerge(build({ commands: [docs, signature], themes: [midnight] }), { ...empty, commands: [{ ...docs }] })
  expect(plan.unchanged).toBe(1)
  expect(plan.conflicts).toEqual([])
  expect(plan.add.map(entry => entry.label)).toEqual(['Signature', 'Midnight'])
  expect(describePlan(plan)).toBe('2 to add · 1 already the same')
})

test('the same command with different content is a conflict, and keeping mine is the default', () => {
  const mine = { ...docs, content: 'https://docs.internal/?q={query}' }
  const plan = planMerge(build({ commands: [docs] }), { ...empty, commands: [mine] })
  expect(plan.add).toEqual([])
  expect(plan.conflicts).toHaveLength(1)
  expect(plan.conflicts[0]).toMatchObject({ kind: 'command', label: 'Docs', mine, row: docs })
  expect(describePlan(plan)).toBe('1 already different here')
  // Nothing is written for a conflict unless the incoming side is chosen.
  expect(resolveMerge(plan)).toEqual([])
  expect(resolveMerge(plan, 'theirs').map(entry => entry.row)).toEqual([docs])
})

test('matching ignores case and surrounding space but not the kind of command', () => {
  const plan = planMerge(build({ commands: [docs, { ...docs, kind: 'snippet', content: 'docs' }] }), { ...empty, commands: [{ ...docs, title: '  DOCS  ' }] })
  expect(plan.conflicts.map(entry => entry.label)).toEqual(['Docs'])
  expect(plan.add.map(entry => entry.kind)).toEqual(['command'])
  expect(plan.add[0]!.row).toMatchObject({ kind: 'snippet' })
})

test('a document from a newer format is refused rather than read', () => {
  const read = readDocument(JSON.stringify({ ...build({ commands: [docs] }), version: documentVersion + 1 }))
  expect(read.ok).toBe(false)
  expect(read.ok === false && read.reason).toContain('newer version of Launchpad')
})

test('a file that is not a settings document is refused with the same answer', () => {
  for (const value of ['', '{', 'null', '[]', '"text"', '{"version":"1"}', '{"version":0}', JSON.stringify({ commands: [] })])
    expect(readDocument(value)).toEqual({ ok: false, reason: 'That file is not a Launchpad settings file.' })
})

test('damaged rows are dropped and the rest of the document still reads', () => {
  const read = readDocument(JSON.stringify({
    version: 1,
    commands: [docs, { title: '', kind: 'quicklink', content: 'x' }, { title: 'No kind', kind: 'shell', content: 'ls' }, { title: 'Long', kind: 'snippet', content: 'x'.repeat(20001) }],
    themes: 'not a list',
    extensions: [{ name: 'Pack', manifest: '{}' }, { name: 'Pack', manifest: '{"other":true}' }],
    favorites: [{ key: '/Applications/Mail.app', favorite: true }],
  }))
  expect(read.ok).toBe(true)
  if (!read.ok) return
  expect(read.document.commands).toEqual([docs])
  expect(read.document.themes).toEqual([])
  // The second pack has the same name, and a name is what identifies an extension.
  expect(read.document.extensions).toEqual([{ name: 'Pack', manifest: '{}', enabled: true }])
  expect(read.document.favorites).toEqual([{ key: '/Applications/Mail.app', aliases: '', favorite: true }])
})

test('an import of an unrelated setup says so rather than reporting nothing', () => {
  expect(describePlan(planMerge(build({}), empty))).toBe('Nothing in this file is new to this Mac.')
})

test('the file is named after the Mac, so one folder can hold several', () => {
  expect(documentName("Glenn's MacBook Pro")).toBe('launchpad-glenn-s-macbook-pro.json')
  expect(documentName('')).toBe('launchpad-settings.json')
  expect(documentName('../../etc/passwd')).toBe('launchpad-etc-passwd.json')
})

test('a kept folder is read back, and anything unusable means no folder', () => {
  expect(readTransferSettings('{"folder":"/Users/me/Dropbox/Launchpad"}')).toEqual({ folder: '/Users/me/Dropbox/Launchpad' })
  for (const value of [undefined, '', '{', '[]', '{"folder":""}', '{"folder":"Dropbox"}', '{"folder":42}', `{"folder":"/${'x'.repeat(1100)}"}`])
    expect(readTransferSettings(value)).toEqual({ folder: '' })
})

test('the file lands in the folder whether or not it was given a trailing slash', () => {
  expect(folderPath('/Users/me/Dropbox', 'launchpad-air.json')).toBe('/Users/me/Dropbox/launchpad-air.json')
  expect(folderPath('/Users/me/Dropbox///', 'launchpad-air.json')).toBe('/Users/me/Dropbox/launchpad-air.json')
})

test('a report says what happened, including the conflicts nothing happened to', () => {
  expect(describeReport({ added: 3, replaced: 0, unchanged: 4, conflicts: 2 })).toBe('Imported · 3 added · 2 kept as it was here · 4 already the same')
  expect(describeReport({ added: 0, replaced: 2, unchanged: 0, conflicts: 2 })).toBe('Imported · 2 replaced')
  expect(describeReport({ added: 1, replaced: 1, unchanged: 0, conflicts: 3 })).toBe('Imported · 1 added · 1 replaced · 2 kept as it was here')
  expect(describeReport({ added: 0, replaced: 0, unchanged: 0, conflicts: 0 })).toBe('Nothing in that file was new to this Mac.')
})

test('a conflict says which fields differ and what each side holds', () => {
  const mine = { ...docs, content: 'https://docs.internal/?q={query}', shortcut: '⌘⌥D' }
  const difference = describeDifference('command', mine, docs)
  expect(difference).toEqual([
    { field: 'content', label: 'Address', mine: 'https://docs.internal/?q={query}', theirs: 'https://example.com/?q={query}', opaque: false },
    { field: 'shortcut', label: 'Shortcut', mine: '⌘⌥D', theirs: '', opaque: false },
  ])
  // A snippet's body is text, not an address, and the label says so.
  expect(describeDifference('command', { ...signature, content: 'Best wishes' }, signature)[0]).toMatchObject({ label: 'Text' })
})

test('rows that match report no difference at all', () => {
  expect(describeDifference('command', docs, { ...docs })).toEqual([])
  expect(describeDifference('favorite', { key: '/a', aliases: 'x', favorite: true }, { key: '/a', aliases: 'x', favorite: true })).toEqual([])
})

test('a document-valued field is reported as differing rather than printed', () => {
  const difference = describeDifference('theme', { ...midnight, dark: '{"ink":"#111"}' }, midnight)
  expect(difference).toEqual([{ field: 'dark', label: 'Dark colours', mine: '', theirs: '', opaque: true }])
  const manifest = describeDifference('extension', { name: 'Pack', manifest: '{"schema":1}', enabled: true }, { name: 'Pack', manifest: '{"schema":1,"more":true}', enabled: false })
  expect(manifest.map(entry => [entry.label, entry.opaque, entry.mine])).toEqual([['Manifest', true, ''], ['Enabled', false, 'yes']])
})

test('a long value is cut rather than filling the screen, and emptiness is visible', () => {
  const long = 'x'.repeat(200)
  const [difference] = describeDifference('command', { ...signature, content: long }, signature)
  expect(difference!.mine).toHaveLength(90)
  expect(difference!.mine.endsWith('…')).toBe(true)
  // An absent value is empty, not the word "nothing": a snippet whose text is literally "nothing" must look different.
  expect(describeDifference('favorite', { key: '/a', aliases: '', favorite: true }, { key: '/a', aliases: 'post', favorite: true })[0]).toMatchObject({ mine: '', theirs: 'post' })
  expect(describeDifference('favorite', { key: '/a', aliases: 'nothing', favorite: true }, { key: '/a', aliases: '', favorite: true })[0]).toMatchObject({ mine: 'nothing', theirs: '' })
})

test('whitespace in a value is flattened so one line stays one line', () => {
  const [difference] = describeDifference('command', { ...signature, content: 'Kind\n\nregards,\n  Glenn' }, signature)
  expect(difference!.mine).toBe('Kind regards, Glenn')
})
