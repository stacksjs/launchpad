import { afterEach, beforeEach, expect, test } from 'bun:test'
import { releaseOrm } from '@stacksjs/query-builder'
import { openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'
import Command from '../app/Models/Command'
import Extension from '../app/Models/Extension'
import LaunchRecord from '../app/Models/LaunchRecord'
import Theme from '../app/Models/Theme'
import { models } from '../app/Desktop/models'
import { createTransferApi } from '../app/Desktop/transfer'
import { readDocument } from '../resources/functions/transfer'
import type { Database } from 'bun:sqlite'

let db: Database
let written: Record<string, string>

beforeEach(() => {
  written = {}
  db = openNativeDatabase({ path: ':memory:', models })
})
afterEach(() => {
  releaseOrm()
  db.close()
})

const api = (files: Record<string, string> = written) => createTransferApi({
  version: '1.1.3',
  machine: () => 'test-mac',
  now: () => new Date('2026-11-05T09:30:00.000Z'),
  read: async (path) => {
    if (!(path in files)) throw new Error('missing')
    return { text: files[path]!, bytes: files[path]!.length }
  },
  write: async (path, text) => {
    written[path] = text
    return text.length
  },
})

const post = (path: string, body: unknown) => api()(new Request(`http://launchpad.test${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
const data = async (response: Response | null) => (await response!.json() as { data: any }).data
const failure = async (response: Response | null) => (await response!.json() as { error: string }).error

async function seed() {
  await Command.create({ title: 'Docs', kind: 'quicklink', content: 'https://example.com/?q={query}', alias: 'docs', shortcut: '' })
  await Theme.create({ name: 'Midnight', light: '{"ink":"#000"}', dark: '{"ink":"#fff"}', font: '' })
  await Extension.create({ name: 'Pack', manifest: '{"schema":1}', enabled: true })
  await AppPreference.create({ key: 'appearance', value: 'dark' })
  await AppPreference.create({ key: 'usage', value: '{"enabled":true}' })
  await LaunchRecord.create({ key: '/Applications/Mail.app', aliases: 'post', favorite: true, launches: 97, lastUsed: 1762330000000 })
  await LaunchRecord.create({ key: '/Applications/Safari.app', aliases: '', favorite: false, launches: 412, lastUsed: 1762331000000 })
}

test('an export writes one file holding the configuration and nothing else', async () => {
  await seed()
  const result = await data(await post('/api/transfer/export', { path: '/tmp/launchpad-test-mac.json' }))
  expect(result.path).toBe('/tmp/launchpad-test-mac.json')
  const read = readDocument(written['/tmp/launchpad-test-mac.json']!)
  expect(read.ok).toBe(true)
  if (!read.ok) return
  expect(read.document.launchpad).toBe('1.1.3')
  expect(read.document.commands.map(row => row.title)).toEqual(['Docs'])
  expect(read.document.themes.map(row => row.name)).toEqual(['Midnight'])
  expect(read.document.extensions.map(row => row.name)).toEqual(['Pack'])
  // Only the carried preference, and only the favourited ranking row.
  expect(read.document.preferences).toEqual([{ key: 'appearance', value: 'dark' }])
  expect(read.document.favorites).toEqual([{ key: '/Applications/Mail.app', aliases: 'post', favorite: true }])
  expect(written['/tmp/launchpad-test-mac.json']).not.toContain('97')
})

test('the suggested name is the machine, so one folder can hold both Macs', async () => {
  const result = await data(await api()(new Request('http://launchpad.test/api/transfer')))
  expect(result.name).toBe('launchpad-test-mac.json')
  expect(result.carried).not.toContain('usage')
})

test('a preview reports what an import would do without doing it', async () => {
  await seed()
  await post('/api/transfer/export', { path: '/file.json' })
  await Command.where('alias', 'docs').delete()
  const preview = await data(await post('/api/transfer/preview', { path: '/file.json' }))
  expect(preview.add.map((entry: any) => entry.label)).toEqual(['Docs'])
  expect(preview.conflicts).toEqual([])
  expect(preview.summary).toBe('1 to add · 4 already the same')
  expect(await Command.where('alias', 'docs').first()).toBeUndefined()
})

test('an import adds what is missing and leaves a launch count alone', async () => {
  await seed()
  await post('/api/transfer/export', { path: '/file.json' })
  await Command.where('alias', 'docs').delete()
  await LaunchRecord.where('key', '/Applications/Mail.app').delete()
  const report = await data(await post('/api/transfer/import', { path: '/file.json' }))
  expect(report).toMatchObject({ added: 2, replaced: 0, conflicts: 0 })
  expect((await Command.where('alias', 'docs').first())?.content).toBe('https://example.com/?q={query}')
  const mail = await LaunchRecord.where('key', '/Applications/Mail.app').first()
  // SQLite keeps a boolean as 0 or 1, which is why the export reads these columns for truthiness rather than identity.
  expect(mail).toMatchObject({ favorite: 1, aliases: 'post' })
  // The favourite came back; the 97 launches it had on the other Mac did not.
  expect(mail?.launches).toBe(0)
})

test('a row that differs is left alone unless the incoming side is chosen', async () => {
  await seed()
  await post('/api/transfer/export', { path: '/file.json' })
  const docs = await Command.where('alias', 'docs').first()
  await Command.update(docs!.id, { content: 'https://docs.internal/?q={query}' })

  const kept = await data(await post('/api/transfer/import', { path: '/file.json' }))
  expect(kept).toMatchObject({ added: 0, replaced: 0, conflicts: 1 })
  expect((await Command.where('alias', 'docs').first())?.content).toBe('https://docs.internal/?q={query}')

  const taken = await data(await post('/api/transfer/import', { path: '/file.json', choice: 'theirs' }))
  expect(taken).toMatchObject({ added: 0, replaced: 1, conflicts: 1 })
  expect((await Command.where('alias', 'docs').first())?.content).toBe('https://example.com/?q={query}')
})

test('taking the incoming side of a favourite still keeps this Mac\'s launch count', async () => {
  await seed()
  await post('/api/transfer/export', { path: '/file.json' })
  const mail = await LaunchRecord.where('key', '/Applications/Mail.app').first()
  await LaunchRecord.update(mail!.id, { aliases: 'mail', launches: 3 })
  const report = await data(await post('/api/transfer/import', { path: '/file.json', choice: 'theirs' }))
  expect(report.replaced).toBe(1)
  const after = await LaunchRecord.where('key', '/Applications/Mail.app').first()
  expect(after).toMatchObject({ aliases: 'post', favorite: 1 })
  expect(after?.launches).toBe(3)
})

test('importing the same file twice changes nothing the second time', async () => {
  await seed()
  await post('/api/transfer/export', { path: '/file.json' })
  await Command.where('alias', 'docs').delete()
  expect((await data(await post('/api/transfer/import', { path: '/file.json' }))).added).toBe(1)
  const again = await data(await post('/api/transfer/import', { path: '/file.json' }))
  expect(again).toMatchObject({ added: 0, replaced: 0, conflicts: 0 })
  expect(await Command.where('kind', 'quicklink').get()).toHaveLength(1)
})

test('a file written by a newer Launchpad is refused', async () => {
  const response = await post('/api/transfer/preview', { path: '/newer.json' })
  expect(response!.status).toBe(400)
  written['/newer.json'] = JSON.stringify({ version: 99, commands: [] })
  expect(await failure(await post('/api/transfer/preview', { path: '/newer.json' }))).toContain('newer version of Launchpad')
})

test('a path that is not an absolute file path is refused before anything is read', async () => {
  for (const path of ['', 'relative/file.json', '~/file.json', '/tmp/\0.json', 'x'.repeat(1100)])
    expect(await failure(await post('/api/transfer/export', { path }))).toBe('That is not a usable file path.')
  expect(Object.keys(written)).toEqual([])
})

test('an unknown transfer path and a wrong method are refused rather than ignored', async () => {
  const unknown = await post('/api/transfer/other', { path: '/file.json' })
  expect(unknown!.status).toBe(404)
  const wrong = await api()(new Request('http://launchpad.test/api/transfer/import', { method: 'DELETE' }))
  expect(wrong!.status).toBe(405)
  expect(await api()(new Request('http://launchpad.test/api/other'))).toBeNull()
})

test('a kept folder names the file itself, so both Macs agree on the name', async () => {
  await seed()
  const result = await data(await post('/api/transfer/export', { folder: '/Users/me/Dropbox/Launchpad/' }))
  expect(result.path).toBe('/Users/me/Dropbox/Launchpad/launchpad-test-mac.json')
  expect(Object.keys(written)).toEqual(['/Users/me/Dropbox/Launchpad/launchpad-test-mac.json'])
})

test('a folder that is not an absolute path is refused like any other', async () => {
  expect(await failure(await post('/api/transfer/export', { folder: 'Dropbox' }))).toBe('That is not a usable file path.')
  expect(Object.keys(written)).toEqual([])
})
