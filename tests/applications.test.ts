import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApplicationDiscovery } from '../app/Desktop/applications'
import { createApplicationRefresh } from '../resources/functions/applications'
import { createApplicationIconLoader } from '../resources/functions/application-icons'
import type { Result } from '../resources/functions/search'
import { rankResults } from '../resources/functions/search'

test.skipIf(process.platform !== 'darwin')('localized app names display correctly while filenames remain searchable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launchpad-localized-app-'))
  try {
    const path = join(root, 'Things3.app')
    await mkdir(join(path, 'Contents/Resources/en.lproj'), { recursive: true })
    await writeFile(join(path, 'Contents/Info.plist'), '<plist version="1.0"><dict><key>CFBundleName</key><string>Things3</string><key>CFBundleDisplayName</key><string>Things3</string><key>CFBundleIdentifier</key><string>com.example.things</string><key>CFBundleDevelopmentRegion</key><string>en</string></dict></plist>')
    await writeFile(join(path, 'Contents/Resources/en.lproj/InfoPlist.strings'), '"CFBundleDisplayName" = "Things"; "CFBundleName" = "Things";')
    const apps = await createApplicationDiscovery([root])()
    expect(apps[0]?.title).toBe('Things')
    expect(apps[0]?.key).toBe(path)
    expect(apps[0]?.content).toBe(path)
    expect(rankResults(apps, 'Things3')[0]?.title).toBe('Things')
    expect(rankResults(apps, 'com.example.things')[0]?.title).toBe('Things')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('discovery picks up installations after startup, nested apps and removals', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launchpad-apps-'))
  try {
    const discovery = createApplicationDiscovery([root])
    expect(await discovery()).toEqual([])
    await mkdir(join(root, 'Things3.app'))
    expect((await discovery()).map(app => app.title)).toContain('Things3')
    await mkdir(join(root, 'Design/Example.app/Contents/Hidden.app'), { recursive: true })
    const apps = await discovery()
    expect(apps.map(app => app.title)).toEqual(['Example', 'Things3'])
    await rm(join(root, 'Things3.app'), { recursive: true })
    expect((await discovery()).some(app => app.title === 'Things3')).toBe(false)
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('concurrent discovery shares one scan and missing roots do not discard valid apps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launchpad-apps-'))
  try {
    await mkdir(join(root, 'Things3.app'))
    const discovery = createApplicationDiscovery([root, join(root, 'absent')])
    const [first, second] = await Promise.all([discovery(), discovery()])
    expect(first).toBe(second)
    expect(first[0]?.content).toBe(join(root, 'Things3.app'))
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('same-name apps have stable ordering regardless of directory scan completion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launchpad-apps-'))
  try {
    const first = join(root, 'A')
    const second = join(root, 'B')
    await Promise.all([first, second].map(path => mkdir(join(path, 'Example.app'), { recursive: true })))
    for (let run = 0; run < 20; run++) {
      const apps = await createApplicationDiscovery(run % 2 ? [first, second] : [second, first])()
      expect(apps.map(app => app.content)).toEqual([join(first, 'Example.app'), join(second, 'Example.app')])
    }
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('activation refresh shares requests, retains commands and avoids replacing unchanged results', async () => {
  let rows: Result[] = [{ key: 'snippet', title: 'Saved', kind: 'snippet', content: 'text', subtitle: '' }]
  let reads = 0
  let replacements = 0
  let count = 0
  let apps: Result[] = [{ key: '/Things3.app', title: 'Things3', kind: 'application', content: '/Things3.app', subtitle: 'Application' }]
  const refresh = createApplicationRefresh({ load: async () => { reads++; return apps }, current: () => rows, replace: value => { replacements++; rows = value }, count: value => { count = value } })
  await Promise.all([refresh(), refresh()])
  expect(reads).toBe(1)
  expect(rows.map(item => item.title)).toEqual(['Things3', 'Saved'])
  expect(count).toBe(1)
  await refresh()
  expect(replacements).toBe(1)
  apps = apps.map(app => ({ ...app, searchAliases: ['Original filename'] }))
  await refresh()
  expect(rows[0]?.searchAliases).toEqual(['Original filename'])
  apps = apps.map(app => ({ ...app, searchAliases: ['New filename alias'] }))
  await refresh()
  expect(rows[0]?.searchAliases).toEqual(['New filename alias'])
  apps = []
  await refresh()
  expect(rows.map(item => item.title)).toEqual(['Saved'])
  expect(count).toBe(0)
})

test('icon reads share a global concurrency bound, cache misses and survive one broken icon', async () => {
  let active = 0
  let peak = 0
  const reads: string[] = []
  const icons = createApplicationIconLoader(async (path) => {
    reads.push(path)
    peak = Math.max(peak, ++active)
    await Bun.sleep(1)
    active--
    if (path === 'broken') throw new Error('unreadable icon')
    return path === 'missing' ? null : 'data:' + path
  }, 2)
  const [first, second] = await Promise.all([icons(['a', 'b', 'missing', 'broken']), icons(['a', 'c', 'missing'])])
  expect(first).toEqual({ a: 'data:a', b: 'data:b' })
  expect(second).toEqual({ a: 'data:a', c: 'data:c' })
  await icons(['a', 'missing', 'broken'])
  expect(reads.sort()).toEqual(['a', 'b', 'broken', 'c', 'missing'])
  expect(peak).toBe(2)
})
