import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import LaunchRecord from '../app/Models/LaunchRecord'
import { createResultSearch } from '../resources/functions/search'

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
