import { expect, test } from 'bun:test'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import LauncherActivity from '../app/Models/LauncherActivity'
import LauncherUsageDay from '../app/Models/LauncherUsageDay'
import UsageRecordingPeriod from '../app/Models/UsageRecordingPeriod'
import PantryInstallation from '../app/Models/PantryInstallation'
import AppPreference from '../app/Models/AppPreference'
import { createActivityApi } from '../app/Desktop/activity'
import { pantryApi } from '../app/Desktop/pantry'
import { bundledPackageCatalog } from 'ts-pantry/catalog'
import { PantryDesktopClient } from 'ts-pantry/desktop'
import { startDesktopBridge, createDesktopPairingCode } from 'ts-pantry/desktop/service'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const models = { LauncherActivity, LauncherUsageDay, UsageRecordingPeriod, PantryInstallation, AppPreference }
const start = Date.parse('2026-10-27T12:00:00Z')
function fixture() {
  const db = openNativeDatabase({ path: ':memory:', models })
  let now = start
  let elapsed = 0
  const clock = { now: () => now, monotonic: () => elapsed, offset: () => 0 }
  const modelApi = createNativeModelApi({ models, authorize: () => true })
  const api = createActivityApi(modelApi, clock)
  return { db, api, modelApi, clock, advance: (ms: number) => { now += ms; elapsed += ms } }
}
function job(kind: 'app' | 'cli' | 'library' | 'font', createdAt: number, status: 'succeeded' | 'failed' = 'succeeded') {
  return { id: crypto.randomUUID(), requestId: crypto.randomUUID(), domain: `${kind}.example`, kind, status, createdAt: new Date(createdAt).toISOString(), startedAt: new Date(createdAt + 100).toISOString(), finishedAt: new Date(createdAt + 2100).toISOString(), timezoneOffset: 0, output: 'private installer output https://secret.example/private' }
}
const totals = async (api: ReturnType<typeof createActivityApi>) => (await (await api(new Request('http://localhost/api/activity-summary?year=2026')))!.json()).data

test('terminal Pantry receipts count each package kind once without retaining output', async () => {
  const f = fixture()
  try {
    await f.api.checkpoint()
    const receipts = (['app', 'cli', 'library', 'font'] as const).map(kind => job(kind, start + 1000))
    f.advance(4000)
    await f.api.recordPantryJobs(receipts)
    await f.api.recordPantryJobs(receipts)
    const summary = await totals(f.api)
    expect(summary.pantry.installed).toBe(4)
    expect(summary.pantry.byKind).toEqual({ app: 1, cli: 1, library: 1, font: 1 })
    expect(summary.pantry.installMs).toBe(8000)
    expect(summary.pantry.timedInstalls).toBe(4)
    expect(summary.pantry.daily['2026-10-27']).toBe(4)
    expect(summary.pantry.topPackages).toHaveLength(4)
    expect(await PantryInstallation.count()).toBe(4)
    expect(JSON.stringify(await PantryInstallation.limit(10).get())).not.toContain('secret.example')
    await f.api.recordPantryJobs([job('library', start + 1000, 'failed')])
    expect((await totals(f.api)).pantry.failed).toBe(1)
    expect((await totals(f.api)).pantry.installed).toBe(4)
    expect((await f.modelApi(new Request('http://localhost/api/pantry-installations', { method: 'POST', body: '{}' })))?.status).toBe(405)
    expect((await f.modelApi(new Request('http://localhost/api/usage-periods', { method: 'POST', body: '{}' })))?.status).toBe(405)
  }
  finally { f.db.close() }
})

test('recording periods exclude paused and cleared installs and survive a process restart', async () => {
  const f = fixture()
  try {
    await f.api.checkpoint()
    f.advance(4000)
    const first = job('app', start + 1000)
    await f.api.recordPantryJobs([first])
    const preference = async (enabled: boolean, id?: number) => (await (await f.api(new Request('http://localhost/api/preferences' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify({ key: 'usage', value: JSON.stringify({ enabled }) }) })))!.json()).data
    const pref = await preference(false)
    const paused = job('cli', start + 5000)
    f.advance(5000)
    await f.api.recordPantryJobs([paused])
    expect(await PantryInstallation.count()).toBe(1)
    await preference(true, pref.id)
    const spansPause = { ...job('library', start + 2000), finishedAt: new Date(start + 10000).toISOString() }
    f.advance(5000)
    await f.api.recordPantryJobs([paused, spansPause])
    expect(await PantryInstallation.count()).toBe(1)
    const later = job('font', start + 11000)
    await f.api.finish()
    f.advance(5000)
    const restarted = createActivityApi(f.modelApi, f.clock)
    await restarted.recordPantryJobs([first, later])
    expect((await totals(restarted)).pantry.installed).toBe(2)
    await restarted(new Request('http://localhost/api/activity-events', { method: 'DELETE' }))
    expect(await PantryInstallation.count()).toBe(0)
    await restarted.recordPantryJobs([first, later])
    expect((await totals(restarted)).pantry.installed).toBe(0)
    const future = job('cli', start + 20000)
    f.advance(5000)
    await restarted.recordPantryJobs([future])
    expect((await totals(restarted)).pantry.byKind.cli).toBe(1)
  }
  finally { f.db.close() }
})

test('failed receipt writes retry through the native checkpoint without duplication', async () => {
  const f = fixture()
  try {
    await f.api.checkpoint()
    const receipt = job('cli', start + 1000)
    f.advance(4000)
    await f.api.checkpoint()
    f.db.exec('PRAGMA query_only = ON')
    await expect(f.api.recordPantryJobs([receipt])).rejects.toThrow()
    f.db.exec('PRAGMA query_only = OFF')
    await f.api.checkpoint()
    await f.api.recordPantryJobs([receipt])
    expect(await PantryInstallation.count()).toBe(1)
  }
  finally { f.db.close() }
})

test('the real Pantry proxy reconciles receipts, supports older v1 metadata and honors clearing', async () => {
  const f = fixture()
  const directory = mkdtempSync(join(tmpdir(), 'launchpad-pantry-proxy-'))
  const entry = bundledPackageCatalog().find(item => item.kind === 'cli')!
  const bridge = startDesktopBridge({ stateDirectory: directory, port: 0, catalog: [entry], now: f.clock.now, run: async () => { f.advance(2000); return 0 } })
  const baseUrl = `http://127.0.0.1:${bridge.server.port}`
  let legacy = false
  try {
    await f.api.checkpoint()
    const token = await new PantryDesktopClient({ baseUrl }).pair(createDesktopPairingCode(directory, f.clock.now()), 'Launchpad test')
    const client = new PantryDesktopClient({ token, fetch: async (target, init) => {
      const path = new URL(String(target)).pathname
      const response = await pantryApi(new Request(`http://localhost/api/pantry/desktop${path}`, init), {
        onJobs: f.api.recordPantryJobs,
        fetch: async (url, options) => {
          const response = await fetch(baseUrl + new URL(String(url)).pathname, options)
          if (!legacy || !response.ok) return response
          const body = await response.json()
          for (const job of body.jobs ?? [body.job]) if (job) {
            delete job.kind
            delete job.startedAt
            delete job.timezoneOffset
          }
          return Response.json(body, { status: response.status })
        },
      })
      return response!
    } })
    const first = await client.install(entry.domain)
    await client.job(first.id)
    await client.jobs()
    expect((await totals(f.api)).pantry.byKind.cli).toBe(1)
    expect((await totals(f.api)).pantry.timedInstalls).toBe(1)
    legacy = true
    await client.install(entry.domain)
    await client.jobs()
    await client.jobs()
    expect((await totals(f.api)).pantry.byKind.cli).toBe(2)
    expect((await totals(f.api)).pantry.timedInstalls).toBe(1)
    await f.api(new Request('http://localhost/api/activity-events', { method: 'DELETE' }))
    await client.jobs()
    expect((await totals(f.api)).pantry.installed).toBe(0)
  }
  finally {
    await bridge.close()
    f.db.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('year-review install totals use the completion calendar day and recorded timezone', async () => {
  const f = fixture()
  try {
    await f.api.checkpoint()
    const created = Date.parse('2026-12-31T23:00:00Z')
    const finished = Date.parse('2027-01-01T02:00:00Z')
    f.advance(finished - start + 1000)
    await f.api.recordPantryJobs([{ ...job('app', created), finishedAt: new Date(finished).toISOString(), timezoneOffset: 480 }])
    const year = await totals(f.api)
    expect(year.pantry.installed).toBe(1)
    expect(year.pantry.daily['2026-12-31']).toBe(1)
    const nextYear = (await (await f.api(new Request('http://localhost/api/activity-summary?year=2027')))!.json()).data
    expect(nextYear.pantry.installed).toBe(0)
  }
  finally { f.db.close() }
})
