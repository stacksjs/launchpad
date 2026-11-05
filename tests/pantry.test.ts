import { expect, test } from 'bun:test'
import { openNativeDatabase, createNativeModelApi } from '@stacksjs/orm/native'
import type { PackageCatalogEntry } from 'ts-pantry/catalog'
import { bundledPackageCatalog } from 'ts-pantry/catalog'
import AppPreference from '../app/Models/AppPreference'
import CatalogPackage from '../app/Models/CatalogPackage'
import { pantryApi } from '../app/Desktop/pantry'
import { createPackageCatalogSearch, installedCatalog, packageInstallState, pantryResults } from '../resources/functions/pantry'
import { rankResults } from '../resources/functions/search'

test('the complete public catalog persists through a read-only native model API', async () => {
  const models = { CatalogPackage, AppPreference }
  const db = openNativeDatabase({ path: ':memory:', models })
  try {
    const response = await pantryApi(new Request('http://localhost/api/pantry/catalog'))
    const { data } = await response!.json()
    expect(data.length).toBe(bundledPackageCatalog().length)
    expect(await CatalogPackage.count()).toBe(data.length)
    expect(data.some((item: PackageCatalogEntry) => item.kind === 'library')).toBe(true)
    const api = createNativeModelApi({ models, authorize: () => true })
    expect((await api(new Request('http://localhost/api/catalog-packages', { method: 'POST', body: '{}' })))?.status).toBe(405)
    expect((await pantryApi(new Request('http://localhost/api/pantry/desktop/arbitrary-command', { method: 'POST' })))?.status).toBe(404)
  }
  finally { db.close() }
})
test('All search preserves original logos, installed versions and application deduplication', () => {
  const catalog = bundledPackageCatalog()
  const results = pantryResults(catalog, [{key: '/Figma.app', title: 'Figma', kind: 'application', content: '/Figma.app', subtitle: 'Application'}], [{ name: 'stedolan.github.io/jq', version: '1.8.1' }])
  expect(results.some(item => item.title === 'Figma' && item.package?.kind === 'app')).toBe(false)
  expect(rankResults(results, 'jq')[0]?.installedVersion).toBe('1.8.1')
  expect(results.some(item => item.icon?.startsWith('https://raw.githubusercontent.com/pantry-pm/pantry/main/assets/'))).toBe(true)
  for (const kind of ['app', 'cli', 'library', 'font']) expect(pantryResults(catalog, [], [], kind).every(item => item.package?.kind === kind)).toBe(true)
})

test('All prepares only installed Pantry packages while Pantry keeps the complete catalog', () => {
  const catalog = bundledPackageCatalog()
  const installed = [{ name: 'stedolan.github.io/jq', version: '1.8.1' }]
  const results = pantryResults(installedCatalog(catalog, installed), [], installed)
  expect(results).toHaveLength(1)
  expect(results[0]?.installedVersion).toBe('1.8.1')
  expect(results[0]?.content).toBe('stedolan.github.io/jq')
  expect(pantryResults(catalog, [], installed, 'all', true)).toHaveLength(catalog.length)
})

test('Things search excludes unrelated installed packages from the complete Pantry catalog', () => {
  const catalog = bundledPackageCatalog()
  const app = { key: '/Applications/Things3.app', title: 'Things3', kind: 'application', content: '/Applications/Things3.app', subtitle: 'Application' }
  const packages = pantryResults(catalog, [app], catalog.map(entry => ({ name: entry.domain, version: '1' })))
  expect(rankResults([app, ...packages], 'Things').map(item => item.title)).toEqual(['Things3'])
  expect(rankResults(packages, 'jq')[0]?.title).toBe('jq')
  expect(rankResults(packages, 'git')[0]?.title).toBe('git')
})

test('compact app abbreviations survive literal matches in real Pantry executable names', () => {
  const catalog = bundledPackageCatalog()
  const apps = ['Google Chrome', 'Visual Studio Code', 'System Settings'].map(title => ({ key: title, title, kind: 'application', content: title, subtitle: 'Application' }))
  const packages = pantryResults(catalog, apps, catalog.map(entry => ({ name: entry.domain, version: '1' })))
  expect(rankResults([...apps, ...packages], 'vsc')[0]?.title).toBe('Visual Studio Code')
  expect(rankResults([...apps, ...packages], 'vscode').some(item => item.title === 'Visual Studio Code')).toBe(true)
  expect(rankResults([...apps, ...packages], 'sst')[0]?.title).toBe('System Settings')
})

test('literal Pantry descriptions survive when the package name also has a fuzzy match', () => {
  const catalog = bundledPackageCatalog()
  const candidates = createPackageCatalogSearch(catalog)('json', { limit: 50000 })
  const results = rankResults(pantryResults(candidates, [], [], 'all', true), 'json', 'pantry')
  expect(results.some(item => item.title === 'jansson')).toBe(true)
})

test('oversized Pantry requests are refused from their declared length', async () => {
  const response = await pantryApi(new Request('http://localhost/api/pantry/desktop/pair', { method: 'POST', headers: { 'content-length': '5000' }, body: '{}' }), { fetch: () => { throw new Error('must not reach Pantry') } })
  expect(response?.status).toBe(413)
})


test('app installation readiness requires a bundle and permits repair of old successful jobs', () => {
  const entry = { ...bundledPackageCatalog().find(item => item.domain === 'figma.com')! }
  const stored = [{ name: entry.domain, version: '1' }]
  const job = { id: crypto.randomUUID(), requestId: crypto.randomUUID(), domain: entry.domain, status: 'succeeded' as const, createdAt: new Date().toISOString(), output: 'done' }
  expect(packageInstallState(entry, stored, job, true)).toMatchObject({ ready: false, repair: true, disabled: false, button: 'Repair installation' })
  expect(installedCatalog([entry], stored)).toEqual([])
  expect(pantryResults([entry], [], stored)[0]?.installedVersion).toBeUndefined()
  const installed = [{ ...stored[0]!, applicationPath: '/Users/test/Applications/Figma.app' }]
  expect(packageInstallState(entry, installed, job, true)).toMatchObject({ ready: true, repair: false, applicationPath: installed[0]?.applicationPath })
  expect(pantryResults([entry], [], installed)[0]).toMatchObject({ kind: 'application', content: installed[0]?.applicationPath })
  expect(packageInstallState(entry, [], { ...job, status: 'running' }, true)).toMatchObject({ active: true, disabled: true })
  expect(packageInstallState(entry, [], { ...job, status: 'failed', error: 'No compatible artifact' }, true)).toMatchObject({ disabled: false, button: 'Try again', status: 'No compatible artifact' })
  expect(packageInstallState(entry, [], null, false).button).toBe('Connect Pantry')
})
