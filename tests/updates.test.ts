import { expect, test } from 'bun:test'
import { openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'
import { createAutomaticUpdates } from '../app/Desktop/updates'

test('native background checks download updates, honor the preference, and never install automatically', async () => {
  const db = openNativeDatabase({ path: ':memory:', models: { AppPreference } })
  let now = 0
  let phase = 'idle'
  const actions: string[] = []
  const tick = createAutomaticUpdates(async request => {
    const action = new URL(request.url).pathname.split('/').pop()!
    if (request.method === 'POST') {
      actions.push(action)
      phase = action === 'check' ? 'checking' : 'downloading'
    }
    return Response.json({ phase })
  }, () => now)
  try {
    await tick()
    expect(actions).toEqual(['check'])
    await tick()
    expect(actions).toHaveLength(1)
    phase = 'available'
    await tick()
    expect(actions).toEqual(['check', 'download'])
    phase = 'ready'
    now += 7 * 60 * 60 * 1000
    await tick()
    expect(actions).toHaveLength(2)
    const preference = await AppPreference.create({ key: 'updates', value: '{"enabled":false}' })
    phase = 'idle'
    await tick()
    expect(actions).toHaveLength(2)
    await AppPreference.where('id', preference.id).update({ value: '{"enabled":true}' })
    await tick()
    expect(actions).toEqual(['check', 'download', 'check'])
    phase = 'current'
    await tick()
    expect(actions).toHaveLength(3)
    now += 6 * 60 * 60 * 1000
    await tick()
    expect(actions).toEqual(['check', 'download', 'check', 'check'])
  }
  finally { db.close() }
})
