import { expect, test } from 'bun:test'
import { openNativeDatabase } from '@stacksjs/orm/native'
import ClipboardEntry from '../app/Models/ClipboardEntry'
import AppPreference from '../app/Models/AppPreference'
import LaunchRecord from '../app/Models/LaunchRecord'
import { clearClipboardHistory, pruneClipboardHistory } from '../app/Desktop/history'

test('history honors retention, preserves newer text and clears its ranking metadata', async () => {
  const database = openNativeDatabase({ path: ':memory:', models: { ClipboardEntry, AppPreference, LaunchRecord } })
  try {
    const now = Date.now()
    await AppPreference.create({ key: 'history', value: JSON.stringify({ enabled: true, days: 1 }) })
    const old = await ClipboardEntry.create({ content: 'Expired test text', capturedAt: now - 2 * 86400000 })
    const fresh = await ClipboardEntry.create({ content: 'Current test text', capturedAt: now })
    await LaunchRecord.create({ key: `clipboard:${old.id}`, favorite: true })
    await LaunchRecord.create({ key: 'command:42', favorite: true })
    await pruneClipboardHistory(undefined, now)
    expect(await ClipboardEntry.find(old.id)).toBeUndefined()
    expect((await ClipboardEntry.find(fresh.id))?.content).toBe('Current test text')
    expect(await LaunchRecord.where('key', `clipboard:${old.id}`).first()).toBeUndefined()
    await clearClipboardHistory()
    expect(await ClipboardEntry.limit(10).get()).toEqual([])
    expect((await LaunchRecord.where('key', 'command:42').first())?.favorite).toBeTruthy()
  }
  finally { database.close() }
})

test('history enforces the 200 item cap even when all copies are recent', async () => {
  const database = openNativeDatabase({ path: ':memory:', models: { ClipboardEntry, AppPreference, LaunchRecord } })
  try {
    const now = Date.now()
    for (let index = 0; index < 203; index++) await ClipboardEntry.create({ content: `Test copy ${index}`, capturedAt: now })
    await pruneClipboardHistory(7, now)
    const rows = await ClipboardEntry.limit(300).get()
    expect(rows).toHaveLength(200)
    expect(await ClipboardEntry.find(1)).toBeUndefined()
    expect(await ClipboardEntry.find(203)).not.toBeUndefined()
  }
  finally { database.close() }
})
