import { expect, test } from 'bun:test'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import LauncherActivity from '../app/Models/LauncherActivity'
import AppPreference from '../app/Models/AppPreference'
import { createActivityApi } from '../app/Desktop/activity'
import { ActivityAccumulator, activityPayload } from '../resources/functions/activity'
import pkg from '../package.json'

test('activity payloads exclude personal command contents and file paths', () => {
  const target = { kind: 'snippet', title: 'Private snippet', content: 'secret text', path: '/Users/private' }
  const payload = activityPayload('command_executed', target)
  expect(payload.applicationName).toBe('')
  expect(JSON.stringify(payload)).not.toContain('Private snippet')
  expect(JSON.stringify(payload)).not.toContain('secret text')
  expect(JSON.stringify(payload)).not.toContain('/Users/private')
})

test('year boundaries, travel offsets and streaks use the calendar day at each event', () => {
  const accumulator = new ActivityAccumulator(2026)
  const event = { action: 'command_executed', kind: 'application', applicationName: 'Notes', timezoneOffset: 480 }
  accumulator.add({ ...event, occurredAt: Date.parse('2027-01-01T02:00:00Z') })
  accumulator.add({ ...event, occurredAt: Date.parse('2026-12-31T02:00:00Z') })
  accumulator.add({ ...event, occurredAt: Date.parse('2026-01-01T02:00:00Z') })
  accumulator.add({ ...event, occurredAt: Date.parse('2026-07-01T00:30:00Z'), timezoneOffset: -720 })
  const result = accumulator.finish()
  expect(result.commands).toBe(3)
  expect(result.daily['2026-12-31']).toBe(1)
  expect(result.daily['2025-12-31']).toBeUndefined()
  expect(result.longestStreak).toBe(2)
  expect(result.topApplications).toEqual([{ name: 'Notes', count: 3 }])
})

test('local activity API validates, deduplicates concurrent retries, owns session metadata and honors opt-out', async () => {
  const models = { LauncherActivity, AppPreference }
  const db = openNativeDatabase({ path: ':memory:', models })
  try {
    const api = createActivityApi(createNativeModelApi({ models, authorize: () => true }))
    const post = (body: unknown) => new Request('http://127.0.0.1/api/activity-events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const payload = activityPayload('command_executed', { kind: 'application', title: 'Notes' })
    const responses = await Promise.all([api(post(payload)), api(post(payload))])
    expect(responses.map(response => response?.status).sort()).toEqual([200, 201])
    expect(await LauncherActivity.limit(10).get()).toHaveLength(1)
    expect((await api(post({ ...payload, kind: 'snippet' })))?.status).toBe(409)
    expect((await api(post({ ...payload, eventId: 'invalid' })))?.status).toBe(422)
    const data = await responses.find(response => response?.status === 201)!.json()
    expect(data.data.session_id || data.data.sessionId).toHaveLength(36)
    expect(data.data.app_version || data.data.appVersion).toBe(pkg.version)
    await api(post(activityPayload('session_started')))
    await api(post(activityPayload('session_started')))
    expect(await LauncherActivity.where('action', 'session_started').get()).toHaveLength(1)
    await AppPreference.create({ key: 'usage', value: JSON.stringify({ enabled: false }) })
    expect((await api(post(activityPayload('command_executed', { kind: 'clipboard' }))))?.status).toBe(204)
    expect(await LauncherActivity.limit(10).get()).toHaveLength(2)
    const response = await api(new Request('http://127.0.0.1/api/activity-summary?year=' + new Date().getFullYear()))
    expect((await response!.json()).data.commands).toBe(1)
  }
  finally { db.close() }
})
