import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'
import { createFileSearch, createFilesApi, isIndexable, rankFiles, readLines, searchWords, spotlightPredicate } from '../app/Desktop/files'

test('queries become safe Spotlight predicates', () => {
  expect(searchWords('  annual   report ')).toEqual(['annual', 'report'])
  expect(searchWords('a*b? "c"')).toEqual(['ab', '"c"'])
  expect(searchWords('x'.repeat(200))[0]).toHaveLength(64)
  expect(searchWords('1 2 3 4 5 6 7 8')).toHaveLength(6)
  expect(spotlightPredicate(['annual', 'report'])).toBe('kMDItemFSName == "*annual*"cd && kMDItemFSName == "*report*"cd')
  expect(spotlightPredicate(['annual', 'report'], true)).toBe('kMDItemFSName == "annual*"cd && kMDItemFSName == "*report*"cd')
  expect(spotlightPredicate(['say "hi"', 'a\\b'])).toBe('kMDItemFSName == "*say \\"hi\\"*"cd && kMDItemFSName == "*a\\\\b*"cd')
  expect(spotlightPredicate(['x" || kMDItemKind == "*'])).not.toContain('"cd || ')
})

test('caches, dependencies, hidden items and app internals are never offered', () => {
  const home = '/Users/me'
  for (const path of ['/Users/me/Library/Mail/a.eml', '/Users/me/.ssh/id_rsa', '/Users/me/code/node_modules/x/index.js', '/Users/me/Applications/Tool.app', '/Users/me/Pictures/Photos Library.photoslibrary/originals/a.jpg', '/Users/me/dev/App.xcodeproj/project.pbxproj', '/Users/me', '/Users/me/code/.git/config'])
    expect(isIndexable(path, home)).toBe(false)
  for (const path of ['/Users/me/Documents/Report.pdf', '/Users/me/Documents', '/Users/me/dev/App.xcodeproj', '/Users/me/Pictures/Photos Library.photoslibrary', '/Users/me/LibraryNotes.txt'])
    expect(isIndexable(path, home)).toBe(true)
})

test('exact names lead, then recent files, then shorter paths', () => {
  const file = (path: string, modifiedAt: number) => ({ path, name: path.split('/').at(-1)!, folder: '', directory: false, modifiedAt })
  const ranked = rankFiles([
    file('/h/a/old-budget-notes.txt', 1), file('/h/budget.xlsx', 5), file('/h/zz/budget.pdf', 9), file('/h/budget 2024 final.pdf', 9), file('/h/my-budget.txt', 20),
  ], 'budget')
  expect(ranked.map(entry => entry.path)).toEqual(['/h/zz/budget.pdf', '/h/budget.xlsx', '/h/budget 2024 final.pdf', '/h/my-budget.txt', '/h/a/old-budget-notes.txt'])
})

test('search combines the index, filtering, file details and ranking', async () => {
  const home = await mkdtemp(join(tmpdir(), 'launchpad-files-'))
  try {
    await mkdir(join(home, 'Documents'))
    await mkdir(join(home, 'Library'))
    const report = join(home, 'Documents', 'Annual Report.pdf')
    const folder = join(home, 'Documents', 'Annual Reports')
    await writeFile(report, 'x')
    await mkdir(folder)
    await utimes(report, new Date('2026-01-01'), new Date('2026-01-01'))
    const calls: (readonly string[])[] = []
    const search = createFileSearch({ home, list: async (args) => { calls.push(args); return [report, folder, join(home, 'Library', 'Annual.plist'), join(home, 'Documents', 'gone.pdf'), report] } })
    const { files, available } = await search('annual report')
    expect(available).toBe(true)
    expect(calls).toEqual([
      ['-onlyin', home, 'kMDItemFSName == "annual*"cd && kMDItemFSName == "*report*"cd'],
      ['-onlyin', home, 'kMDItemFSName == "*annual*"cd && kMDItemFSName == "*report*"cd'],
    ])
    expect(files.map(file => file.name)).toEqual(['Annual Report.pdf', 'Annual Reports'])
    expect(files[0]).toMatchObject({ directory: false, folder: '~/Documents' })
    expect(files[1]!.directory).toBe(true)
    expect(await search('a')).toEqual({ files: [], available: true })
    expect(calls).toHaveLength(2)
    expect(await createFileSearch({ home, list: async () => null })('report')).toEqual({ files: [], available: false })
    const partial = await createFileSearch({ home, list: async args => args[2]!.includes('"*') ? null : [report] })('annual')
    expect(partial).toMatchObject({ available: true, files: [{ name: 'Annual Report.pdf' }] })
  }
  finally { await rm(home, { recursive: true, force: true }) }
})

test('the limit applies after ranking', async () => {
  const home = await mkdtemp(join(tmpdir(), 'launchpad-files-'))
  try {
    const paths = await Promise.all(Array.from({ length: 10 }, async (_, index) => { const path = join(home, `note ${index}.txt`); await writeFile(path, ''); return path }))
    const { files } = await createFileSearch({ home, limit: 3, list: async () => paths })('note')
    expect(files).toHaveLength(3)
  }
  finally { await rm(home, { recursive: true, force: true }) }
})

test('a command that never ends is stopped at the line limit or the timeout', async () => {
  const started = performance.now()
  const lines = await readLines('/usr/bin/yes', ['/tmp/file'], { maxLines: 5, timeoutMs: 5000 })
  expect(lines).toEqual(Array(5).fill('/tmp/file'))
  expect(performance.now() - started).toBeLessThan(2000)
  const slow = performance.now()
  expect(await readLines('/bin/sleep', ['20'], { maxLines: 5, timeoutMs: 150 })).toEqual([])
  expect(performance.now() - slow).toBeLessThan(3000)
  expect(await readLines('/definitely/missing', [], { maxLines: 5, timeoutMs: 100 })).toBeNull()
  const controller = new AbortController()
  const pending = readLines('/bin/sleep', ['20'], { maxLines: 5, timeoutMs: 10000, signal: controller.signal })
  controller.abort()
  expect(await pending).toEqual([])
})

test('the files API honors the preference and the query length', async () => {
  const database = openNativeDatabase({ path: ':memory:', models: { AppPreference } })
  try {
    const seen: string[] = []
    const api = createFilesApi(async (query) => { seen.push(query); return { files: [{ path: '/h/a.txt', name: 'a.txt', folder: '~', directory: false, modifiedAt: 1 }], available: true } })
    const get = async (query: string) => (await api(new Request(`http://localhost/api/files?q=${encodeURIComponent(query)}`)))!.json()
    expect((await get('alpha')).data).toHaveLength(1)
    await AppPreference.create({ key: 'search', value: JSON.stringify({ files: false }) })
    expect(await get('alpha')).toEqual({ data: [], available: true, enabled: false })
    expect(seen).toEqual(['alpha'])
    expect(await api(new Request('http://localhost/api/other'))).toBeNull()
    expect(await api(new Request('http://localhost/api/files?q=a', { method: 'POST' }))).toBeNull()
  }
  finally { database.close() }
})
