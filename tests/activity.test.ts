import { expect, test } from 'bun:test'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import LauncherActivity from '../app/Models/LauncherActivity'
import AppPreference from '../app/Models/AppPreference'
import LauncherUsageDay from '../app/Models/LauncherUsageDay'
import { createActivityApi } from '../app/Desktop/activity'
import { ActivityAccumulator, activityPayload, recordSuccessfulOperation } from '../resources/functions/activity'
import { defineModel, MODEL_DEFINITION } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pkg from '../package.json'

test('activity payloads exclude personal command contents and file paths', () => {
  const target = { kind: 'snippet', title: 'Private snippet', content: 'secret text', path: '/Users/private' }
  const payload = activityPayload('command_executed', target)
  expect(payload.applicationName).toBe('')
  expect(activityPayload('command_executed', target, 900000).durationMs).toBe(600000)
  expect(activityPayload('command_executed', target, Number.NaN).durationMs).toBe(0)
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
  const models = { LauncherActivity, AppPreference, LauncherUsageDay }
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

test('the model API counts one process launch and measures running and visible time independently', async () => {
  const models = { LauncherActivity, AppPreference, LauncherUsageDay }
  const db = openNativeDatabase({ path: ':memory:', models })
  let now = Date.parse('2026-10-27T12:00:00Z')
  let elapsed = 0
  const advance = (ms: number) => { now += ms; elapsed += ms }
  try {
    const api = createActivityApi(createNativeModelApi({ models, authorize: () => true }), { now: () => now, monotonic: () => elapsed })
    const post = (action: string, kind = 'launcher') => api(new Request('http://localhost/api/activity-events', { method: 'POST', body: JSON.stringify({ ...activityPayload(action as any, { kind }), occurredAt: now }) }))
    const totals = async (reader = api) => (await (await reader(new Request('http://localhost/api/activity-summary?year=2026')))!.json()).data
    await api.checkpoint()
    await post('palette_opened')
    advance(5000)
    await api.checkpoint()
    await post('palette_opened') // focus and shortcut callbacks for the same visible window
    advance(5000)
    await post('palette_dismissed')
    await post('palette_dismissed') // Escape followed by native blur
    advance(10000)
    await api.checkpoint()
    await post('command_executed', 'application')
    await post('command_executed', 'quicklink')
    await post('command_executed', 'github')
    await post('link_opened', 'pantry')
    const summary = await totals()
    expect(summary.sessions).toBe(1)
    expect(summary.paletteOpens).toBe(1)
    expect(summary.runningMs).toBe(20000)
    expect(summary.visibleMs).toBe(10000)
    expect(summary.applicationsOpened).toBe(1)
    expect(summary.linksOpened).toBe(3)
    await api.finish()
    await api.finish()
    expect(await LauncherActivity.where('action', 'session_ended').get()).toHaveLength(1)
  }
  finally { db.close() }
})

test('usage pauses, sleep gaps and process restarts never inflate recorded time', async () => {
  const models = { LauncherActivity, AppPreference, LauncherUsageDay }
  const db = openNativeDatabase({ path: ':memory:', models })
  let now = Date.parse('2026-10-27T12:00:00Z')
  let elapsed = 0
  const advance = (ms: number) => { now += ms; elapsed += ms }
  try {
    const modelApi = createNativeModelApi({ models, authorize: () => true })
    const api = createActivityApi(modelApi, { now: () => now, monotonic: () => elapsed })
    const preference = (enabled: boolean, id?: number) => api(new Request('http://localhost/api/preferences' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify({ key: 'usage', value: JSON.stringify({ enabled }) }) }))
    await api.checkpoint()
    advance(10000)
    const saved = await (await preference(false))!.json()
    advance(30000)
    await preference(true, saved.data.id)
    advance(5000)
    await api.checkpoint()
    advance(3600000) // suspended process or sleeping Mac
    await api.checkpoint()
    const totals = async (reader = api) => (await (await reader(new Request('http://localhost/api/activity-summary?year=2026')))!.json()).data
    expect((await totals()).runningMs).toBe(15000)
    const restarted = createActivityApi(modelApi, { now: () => now, monotonic: () => elapsed })
    await restarted.checkpoint()
    advance(2000)
    await restarted.finish()
    expect((await totals(restarted)).sessions).toBe(2)
    // The old process does not gain hours merely because a new process started.
    expect((await totals(restarted)).runningMs).toBe(17000)
  }
  finally { db.close() }
})

test('time intervals split across calendar years without treating command latency as usage time', () => {
  const before = new ActivityAccumulator(2026)
  const after = new ActivityAccumulator(2027)
  const timed = { action: 'command_executed', kind: 'calculator', applicationName: '', occurredAt: Date.parse('2027-01-01T00:00:05Z'), timezoneOffset: 0 }
  for (const accumulator of [before, after]) {
    accumulator.addTime('2026-12-31', 5000, 0)
    accumulator.addTime('2027-01-01', 5000, 0)
    accumulator.add(timed)
  }
  expect(before.finish().runningMs).toBe(5000)
  expect(after.finish().runningMs).toBe(5000)
  expect(after.finish().visibleMs).toBe(0)
})

test('native model checkpoints split midnight, remain compact, and cannot be forged by a client', async () => {
  const models = { LauncherActivity, AppPreference, LauncherUsageDay }
  const db = openNativeDatabase({ path: ':memory:', models })
  let now = Date.parse('2026-12-31T23:59:55Z')
  let elapsed = 0
  try {
    const modelApi = createNativeModelApi({ models, authorize: () => true })
    const api = createActivityApi(modelApi, { now: () => now, monotonic: () => elapsed, offset: () => 0 })
    await api.checkpoint()
    await api(new Request('http://localhost/api/activity-events', { method: 'POST', body: JSON.stringify({ ...activityPayload('palette_opened'), occurredAt: now, timezoneOffset: 0 }) }))
    now += 10000; elapsed += 10000
    await Promise.all(Array.from({ length: 20 }, () => api.checkpoint()))
    expect(await LauncherUsageDay.count()).toBe(2)
    const summary = async (year: number) => (await (await api(new Request(`http://localhost/api/activity-summary?year=${year}`)))!.json()).data
    expect((await summary(2026)).runningMs).toBe(5000)
    expect((await summary(2027)).visibleMs).toBe(5000)
    const command = { ...activityPayload('command_executed', { kind: 'quicklink' }, 10000), occurredAt: now, timezoneOffset: 0 }
    await api(new Request('http://localhost/api/activity-events', { method: 'POST', body: JSON.stringify(command) }))
    expect((await summary(2027)).runningMs).toBe(5000)
    expect((await api(new Request('http://localhost/api/activity-events', { method: 'POST', body: JSON.stringify({ ...command, action: 'session_time' }) })))?.status).toBe(422)
    expect((await modelApi(new Request('http://localhost/api/usage-days', { method: 'POST', body: '{}' })))?.status).toBe(405)
    await api(new Request('http://localhost/api/activity-events', { method: 'DELETE' }))
    expect(await LauncherUsageDay.count()).toBe(0)
    expect((await summary(2027)).commands).toBe(0)
    expect((await summary(2027)).runningMs).toBe(0)
  }
  finally { db.close() }
})

test('successful app and link effects are recorded once, while failed launches are not', async () => {
  const calls: string[] = []
  let time = 100
  await recordSuccessfulOperation(async () => { calls.push('opened'); time = 125 }, duration => { calls.push(`recorded:${duration}`) }, () => time)
  expect(calls).toEqual(['opened', 'recorded:25'])
  await expect(recordSuccessfulOperation(async () => { throw new Error('Launch denied') }, () => { calls.push('incorrect') })).rejects.toThrow('Launch denied')
  expect(calls).toHaveLength(2)
})

test('native model upgrades preserve existing activity while adding compact usage totals', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'launchpad-usage-upgrade-'))
  const definition = LauncherActivity[MODEL_DEFINITION]
  const oldActivity = defineModel({ ...definition, attributes: { ...definition.attributes, action: { ...definition.attributes.action, validation: { rule: schema.enum(['session_started', 'palette_opened', 'palette_dismissed', 'command_executed', 'command_created', 'clipboard_saved', 'package_installed', 'github_search']) } } } })
  try {
    const path = join(directory, 'existing.sqlite')
    const previous = openNativeDatabase({ path, models: { LauncherActivity: oldActivity, AppPreference } })
    const payload = { ...activityPayload('command_executed', { kind: 'quicklink' }, 42), action: 'command_executed' as const, recordedAt: Date.now(), sessionId: crypto.randomUUID(), appVersion: '1.0.1' }
    await oldActivity.create(payload)
    previous.close()
    const upgraded = openNativeDatabase({ path, models: { LauncherActivity, AppPreference, LauncherUsageDay } })
    try {
      expect(await LauncherActivity.count()).toBe(1)
      expect((await LauncherActivity.first())?.durationMs).toBe(42)
      const api = createActivityApi(createNativeModelApi({ models: { LauncherActivity, AppPreference, LauncherUsageDay }, authorize: () => true }))
      await api.checkpoint()
      expect(await LauncherActivity.count()).toBe(2)
    }
    finally { upgraded.close() }
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
})
