import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'
import { createFileSearch, createFilesApi, extendsQuery, isIndexable, nameMatches, nameScore, rankFiles, readLines, searchWords, spotlightPredicate } from '../app/Desktop/files'
import type { ReadResult } from '../app/Desktop/files'

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

const done = (lines: string[]): ReadResult => ({ lines, status: 'done' })

test('search combines the index, filtering, file details and ranking with one Spotlight query', async () => {
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
    const search = createFileSearch({ home, list: async (args) => { calls.push(args); return done([report, folder, join(home, 'Library', 'Annual.plist'), join(home, 'Documents', 'gone.pdf'), report]) } })
    const { files, available } = await search('annual report')
    expect(available).toBe(true)
    expect(calls).toEqual([['-onlyin', home, 'kMDItemFSName == "*annual*"cd && kMDItemFSName == "*report*"cd']])
    expect(files.map(file => file.name)).toEqual(['Annual Report.pdf', 'Annual Reports'])
    expect(files[0]).toMatchObject({ directory: false, folder: '~/Documents' })
    expect(files[1]!.directory).toBe(true)
    expect(await search('a')).toEqual({ files: [], available: true })
    expect(calls).toHaveLength(1)
    expect(await createFileSearch({ home, list: async () => ({ lines: [], status: 'unavailable' }) })('report')).toEqual({ files: [], available: false })
  }
  finally { await rm(home, { recursive: true, force: true }) }
})

test('the limit applies after ranking', async () => {
  const home = await mkdtemp(join(tmpdir(), 'launchpad-files-'))
  try {
    const paths = await Promise.all(Array.from({ length: 10 }, async (_, index) => { const path = join(home, `note ${index}.txt`); await writeFile(path, ''); return path }))
    const { files } = await createFileSearch({ home, limit: 3, list: async () => done(paths) })('note')
    expect(files).toHaveLength(3)
  }
  finally { await rm(home, { recursive: true, force: true }) }
})

test('a command that never ends is stopped at the line limit or the timeout, and says why', async () => {
  const started = performance.now()
  expect(await readLines('/usr/bin/yes', ['/tmp/file'], { maxLines: 5, timeoutMs: 5000 })).toEqual({ lines: Array(5).fill('/tmp/file'), status: 'capped' })
  expect(performance.now() - started).toBeLessThan(2000)
  const slow = performance.now()
  expect(await readLines('/bin/sleep', ['20'], { maxLines: 5, timeoutMs: 150 })).toEqual({ lines: [], status: 'timeout' })
  expect(performance.now() - slow).toBeLessThan(3000)
  expect(await readLines('/definitely/missing', [], { maxLines: 5, timeoutMs: 100 })).toEqual({ lines: [], status: 'unavailable' })
  expect(await readLines('/usr/bin/printf', ['a\\nb\\nc'], { maxLines: 5, timeoutMs: 1000 })).toEqual({ lines: ['a', 'b', 'c'], status: 'done' })
  expect(await readLines('/usr/bin/true', [], { maxLines: 5, timeoutMs: 1000 })).toEqual({ lines: [], status: 'done' })
  expect((await readLines('/usr/bin/false', [], { maxLines: 5, timeoutMs: 1000 })).status).toBe('unavailable')
  const controller = new AbortController()
  const pending = readLines('/bin/sleep', ['20'], { maxLines: 5, timeoutMs: 10000, signal: controller.signal })
  controller.abort()
  expect(await pending).toEqual({ lines: [], status: 'aborted' })
})

test('names match every word regardless of case and accents, and longer queries narrow shorter ones', () => {
  expect(nameMatches('Résumé 2026.pdf', ['resume', '2026'])).toBe(true)
  expect(nameMatches('Budget.xlsx', ['budget', 'final'])).toBe(false)
  expect(extendsQuery(['read'], ['readme'])).toBe(true)
  expect(extendsQuery(['annual'], ['annual', 'report'])).toBe(true)
  expect(extendsQuery(['annual', 'report'], ['annual'])).toBe(false)
  expect(extendsQuery(['read'], ['write'])).toBe(false)
  expect(extendsQuery([], ['x'])).toBe(false)
})

test('typing more letters, backspacing and repeating a search never ask Spotlight twice', async () => {
  const home = await mkdtemp(join(tmpdir(), 'launchpad-files-'))
  try {
    const names = ['read me first.txt', 'readme.md', 'README.md', 'spread sheet.numbers', 'unrelated.txt']
    const paths = await Promise.all(names.map(async (name) => { const path = join(home, name); await writeFile(path, ''); return path }))
    const calls: string[] = []
    const search = createFileSearch({ home, list: async (args) => { calls.push(args[2]!); return done(paths.filter(path => nameMatches(path.split('/').at(-1)!, searchWords(args[2]!.match(/\*([^*]+)\*/g)!.map(part => part.replaceAll('*', '')).join(' ')))) ) } })
    expect((await search('read')).files.map(file => file.name).sort()).toEqual(['README.md', 'read me first.txt', 'readme.md', 'spread sheet.numbers'])
    expect(calls).toHaveLength(1)
    expect((await search('readm')).files.map(file => file.name).sort()).toEqual(['README.md', 'readme.md'])
    expect((await search('readme')).files.map(file => file.name).sort()).toEqual(['README.md', 'readme.md'])
    expect((await search('read')).files).toHaveLength(4)
    expect((await search('READ')).files).toHaveLength(4)
    expect((await search('readme md')).files.map(file => file.name).sort()).toEqual(['README.md', 'readme.md'])
    expect(calls).toHaveLength(1)
    await search('unrelated')
    expect(calls).toHaveLength(2)
  }
  finally { await rm(home, { recursive: true, force: true }) }
})

test('only complete answers narrow longer searches; timed out and cancelled ones are never reused', async () => {
  const home = await mkdtemp(join(tmpdir(), 'launchpad-files-'))
  try {
    const path = join(home, 'alpha.txt')
    await writeFile(path, '')
    // A cut-off answer repeats from memory but is not trusted to answer a longer search.
    let capped = 0
    const cappedSearch = createFileSearch({ home, list: async () => { capped++; return { lines: [path], status: 'capped' } } })
    await cappedSearch('alpha')
    await cappedSearch('alphab')
    await cappedSearch('alpha')
    expect(capped).toBe(2)
    for (const status of ['timeout', 'aborted'] as const) {
      let calls = 0
      const search = createFileSearch({ home, list: async () => { calls++; return { lines: [path], status } } })
      await search('alpha')
      await search('alphab')
      await search('alpha')
      expect(calls).toBe(3)
    }
    let aborted = 0
    const controller = new AbortController()
    const search = createFileSearch({ home, list: async () => { aborted++; controller.abort(); return done([]) } })
    await search('beta', controller.signal)
    await search('beta')
    expect(aborted).toBe(2)
  }
  finally { await rm(home, { recursive: true, force: true }) }
})

test('stored answers expire, and identical searches in flight share one query', async () => {
  const home = await mkdtemp(join(tmpdir(), 'launchpad-files-'))
  try {
    const path = join(home, 'gamma.txt')
    await writeFile(path, '')
    let clock = 0
    let calls = 0
    let release = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const search = createFileSearch({ home, now: () => clock, cacheMs: 1000, list: async () => { calls++; await gate; return done([path]) } })
    const [first, second] = [search('gamma'), search('gamma')]
    release()
    await Promise.all([first, second])
    expect(calls).toBe(1)
    clock = 999
    await search('gamma')
    expect(calls).toBe(1)
    clock = 1001
    await search('gamma')
    expect(calls).toBe(2)
  }
  finally { await rm(home, { recursive: true, force: true }) }
})

test('the files API honors the preference and the query length', async () => {
  const database = openNativeDatabase({ path: ':memory:', models: { AppPreference } })
  try {
    const seen: string[] = []
    let clock = 0
    const api = createFilesApi(async (query) => { seen.push(query); return { files: [{ path: '/h/a.txt', name: 'a.txt', folder: '~', directory: false, modifiedAt: 1 }], available: true } }, { now: () => clock })
    const get = async (query: string) => (await api(new Request(`http://localhost/api/files?q=${encodeURIComponent(query)}`)))!.json()
    expect((await get('alpha')).data).toHaveLength(1)
    await AppPreference.create({ key: 'search', value: JSON.stringify({ files: false }) })
    expect((await get('alpha')).enabled).toBe(true)
    clock = 1500
    expect(await get('alpha')).toEqual({ data: [], available: true, enabled: false })
    expect(seen).toEqual(['alpha', 'alpha'])
    expect(await api(new Request('http://localhost/api/other'))).toBeNull()
    expect(await api(new Request('http://localhost/api/files?q=a', { method: 'POST' }))).toBeNull()
  }
  finally { database.close() }
})

test('the best names are examined first even when they arrive last among many candidates', async () => {
  const home = await mkdtemp(join(tmpdir(), 'launchpad-files-'))
  try {
    const noise = await Promise.all(Array.from({ length: 200 }, async (_, i) => { const path = join(home, `old-note-about-budget-${i}.txt`); await writeFile(path, ''); return path }))
    const best = join(home, 'budget.xlsx')
    await writeFile(best, '')
    const stats: string[] = []
    const search = createFileSearch({ home, limit: 5, list: async () => done([...noise, best]), stat: async (path) => { stats.push(path); return { isDirectory: () => false, mtimeMs: 1 } } })
    const { files } = await search('budget')
    expect(files[0]!.name).toBe('budget.xlsx')
    expect(stats).toHaveLength(15)
    expect(stats).toContain(best)
    expect(nameScore('budget.xlsx', ['budget'], 'budget')).toBeGreaterThan(nameScore('old-budget.txt', ['budget'], 'budget'))
  }
  finally { await rm(home, { recursive: true, force: true }) }
})
