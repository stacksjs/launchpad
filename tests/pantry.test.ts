import { expect, test } from 'bun:test'
import { openNativeDatabase, createNativeModelApi } from '@stacksjs/orm/native'
import type { PackageCatalogEntry } from 'ts-pantry/catalog'
import { bundledPackageCatalog } from 'ts-pantry/catalog'
import AppPreference from '../app/Models/AppPreference'
import CatalogPackage from '../app/Models/CatalogPackage'
import { pantryApi } from '../app/Desktop/pantry'
import { pantryResults } from '../resources/functions/pantry'
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
