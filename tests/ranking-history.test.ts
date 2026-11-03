import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import { defineModel, MODEL_DEFINITION } from '@stacksjs/orm/define-model'
import LaunchRecord from '../app/Models/LaunchRecord'
import { createResultSearch } from '../resources/functions/search'
import { applicationSearchAliases } from '../resources/functions/application-aliases'

test('ranking history persists through the native model API and a database reopen', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launchpad-ranking-'))
  const models = { LaunchRecord }
  const path = join(root, 'history.sqlite')
  let db = openNativeDatabase({ path, models })
  let api = createNativeModelApi({ models, authorize: () => true })
  const apps = ['Mail', 'Maps', 'Music'].map(title => ({ key: `/Applications/${title}.app`, title, kind: 'application', subtitle: 'Application', content: `/Applications/${title}.app` }))
  async function readSearch() {
    const response = await api(new Request('http://localhost/api/launch-records'))
    const { data } = await response!.json()
    const records = Object.fromEntries(data.map((row: Record<string, unknown>) => [row.key, row]))
    return createResultSearch(apps.map(item => ({ ...item, ...records[item.key], key: item.key })))
  }
  try {
    for (const [index, app] of apps.entries()) {
      const response = await api(new Request('http://localhost/api/launch-records', { method: 'POST', body: JSON.stringify({ key: app.key, launches: [400, 80, 100][index], lastUsed: [100, 500, 300][index] }) }))
      expect(response?.status).toBe(201)
    }
    expect((await readSearch())('M')[0]?.title).toBe('Mail')
    db.close()
    db = openNativeDatabase({ path, models })
    api = createNativeModelApi({ models, authorize: () => true })
    const previous = await readSearch()
    expect(previous('m')[0]?.title).toBe('Mail')
    const maps = await LaunchRecord.where('key', apps[1]!.key).first()
    const response = await api(new Request(`http://localhost/api/launch-records/${maps!.id}`, { method: 'PATCH', body: JSON.stringify({ launches: 600, lastUsed: 10 }) }))
    expect(response?.ok).toBe(true)
    expect((await readSearch())('m')[0]?.title).toBe('Maps')
    expect(previous('m')[0]?.title).toBe('Mail')
  }
  finally { db.close(); await rm(root, { recursive: true, force: true }) }
})

test('native model upgrades preserve ranking and persist editable app aliases across restarts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launchpad-app-aliases-'))
  const path = join(root, 'history.sqlite')
  const definition = LaunchRecord[MODEL_DEFINITION]
  const { aliases, ...previousAttributes } = definition.attributes
  expect(aliases.default).toBe('')
  const previousModel = defineModel({ ...definition, attributes: previousAttributes })
  let db = openNativeDatabase({ path, models: { LaunchRecord: previousModel } })
  let api = createNativeModelApi({ models: { LaunchRecord: previousModel }, authorize: () => true })
  const key = '/Applications/ChatGPT.app'
  const request = (uri: string, method = 'GET', body?: unknown) => api(new Request('http://localhost/api/' + uri, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }))
  try {
    const created = await request('launch-records', 'POST', { key, launches: 400, lastUsed: 123, favorite: true })
    expect(created?.status).toBe(201)
    db.close()
    db = openNativeDatabase({ path, models: { LaunchRecord } })
    api = createNativeModelApi({ models: { LaunchRecord }, authorize: () => true })
    let row = (await (await request('launch-records'))!.json()).data[0]
    expect(row).toMatchObject({ key, launches: 400, aliases: '' })
    expect(Boolean(row.favorite)).toBe(true)
    expect((await request(`launch-records/${row.id}`, 'PATCH', { aliases: 'work ai\nassistant' }))?.ok).toBe(true)
    db.close()
    db = openNativeDatabase({ path, models: { LaunchRecord } })
    api = createNativeModelApi({ models: { LaunchRecord }, authorize: () => true })
    row = (await (await request('launch-records'))!.json()).data[0]
    expect(row).toMatchObject({ key, launches: 400, aliases: 'work ai\nassistant' })
    expect(Boolean(row.favorite)).toBe(true)
    expect((await request(`launch-records/${row.id}`, 'PATCH', { launches: 401 }))?.ok).toBe(true)
    row = (await (await request('launch-records'))!.json()).data[0]
    expect(row.aliases).toBe('work ai\nassistant')
    const item = { title: 'ChatGPT', kind: 'application', subtitle: 'Application', content: key, searchAliases: applicationSearchAliases({ filename: 'ChatGPT', bundleId: 'com.openai.codex' }), ...row, key }
    expect(createResultSearch([item])('work ai')).toEqual([item])
    expect((await request(`launch-records/${row.id}`, 'PATCH', { aliases: '' }))?.ok).toBe(true)
    row = (await (await request('launch-records'))!.json()).data[0]
    expect(row.launches).toBe(401)
    expect(createResultSearch([{ ...item, ...row }])('work ai')).toEqual([])
    expect(createResultSearch([{ ...item, ...row }])('codex')[0]?.title).toBe('ChatGPT')
    expect((await request(`launch-records/${row.id}`, 'PATCH', { aliases: 'x'.repeat(1001) }))?.status).toBe(422)
  }
  finally { db.close(); await rm(root, { recursive: true, force: true }) }
})

test('simultaneous ranking intents use the persisted row and preserve counts, favorites and aliases', async () => {
  const { createRankingApi } = await import('../app/Desktop/ranking')
  const models = { LaunchRecord }
  const db = openNativeDatabase({ path: ':memory:', models })
  const rank = createRankingApi(createNativeModelApi({ models, authorize: () => true }))
  const key = '/Applications/Activity Monitor.app'
  const send = (action: string, extra = {}) => rank(new Request('http://localhost/api/ranking', { method: 'POST', body: JSON.stringify({ key, action, ...extra }) }))
  try {
    await LaunchRecord.create({ key, launches: 7, aliases: 'monitor' })
    const results = await Promise.all([send('launch'), send('favorite'), send('aliases', { aliases: 'cpu\nmemory' }), send('launch')])
    expect(results.every(response => response?.ok)).toBe(true)
    const row = await LaunchRecord.where('key', key).first()
    expect(row?.launches).toBe(9)
    expect(Boolean(row?.favorite)).toBe(true)
    expect(row?.aliases).toBe('cpu\nmemory')
    expect(await LaunchRecord.count()).toBe(1)
    expect((await send('aliases', { aliases: 'x'.repeat(1001) }))?.status).toBe(422)
    expect((await send('aliases'))?.status).toBe(422)
    expect((await send('launch'))?.ok).toBe(true)
    const newKey = '/Applications/Mail.app'
    const create = () => rank(new Request('http://localhost/api/ranking', { method: 'POST', body: JSON.stringify({ key: newKey, action: 'launch' }) }))
    expect((await Promise.all([create(), create()])).every(response => response?.ok)).toBe(true)
    expect((await LaunchRecord.where('key', newKey).first())?.launches).toBe(2)
  }
  finally { db.close() }
})
