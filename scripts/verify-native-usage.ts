import { strict as assert } from 'node:assert'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Database } from 'bun:sqlite'
import { buildNative } from '@stacksjs/stx/craft'
import { bundledPackageCatalog } from 'ts-pantry/catalog'
const app = resolve(import.meta.dir, '..')
const craftPath = process.env.CRAFT_BIN || Bun.which('craft-webview')
if (!craftPath) throw new Error('Activate the Pantry Craft runtime or set CRAFT_BIN before native qualification.')
const root = mkdtempSync(join(tmpdir(), 'launchpad-usage-qualified-'))
let child: ReturnType<typeof Bun.spawn> | undefined
try {
  const database = join(root, 'usage.sqlite')
  const entry = join(root, 'api.ts')
  const packages = ['app', 'cli', 'library', 'font'].map(kind => bundledPackageCatalog().find(item => item.kind === kind)!)
  await Bun.write(entry, `import { createNativeUpdateApi } from ${JSON.stringify(Bun.resolveSync('@stacksjs/desktop', app))}
import { openNativeDatabase, createNativeModelApi } from ${JSON.stringify(Bun.resolveSync('@stacksjs/orm/native', app))}
import LauncherActivity from '${app}/app/Models/LauncherActivity.ts'
import LauncherUsageDay from '${app}/app/Models/LauncherUsageDay.ts'
import AppPreference from '${app}/app/Models/AppPreference.ts'
import UsageRecordingPeriod from '${app}/app/Models/UsageRecordingPeriod.ts'
import PantryInstallation from '${app}/app/Models/PantryInstallation.ts'
import { createActivityApi, startActivityRuntime } from '${app}/app/Desktop/activity.ts'
import { pantryApi } from '${app}/app/Desktop/pantry.ts'
import CatalogPackage from '${app}/app/Models/CatalogPackage.ts'
import { PantryDesktopClient } from ${JSON.stringify(Bun.resolveSync('ts-pantry/desktop', app))}
import { startDesktopBridge, createDesktopPairingCode } from ${JSON.stringify(Bun.resolveSync('ts-pantry/desktop/service', app))}
const models = { LauncherActivity, LauncherUsageDay, AppPreference, UsageRecordingPeriod, PantryInstallation, CatalogPackage }
openNativeDatabase({ path: ${JSON.stringify(database)}, models })
const modelApi = createNativeModelApi({ models, authorize: () => true })
const api = createActivityApi(modelApi)
const updates = createNativeUpdateApi({ repository: 'stacksjs/launchpad', currentVersion: '1.0.10' })
const stopUsage = startActivityRuntime(api)
const packages = ${JSON.stringify(packages)}
const service = startDesktopBridge({ stateDirectory: ${JSON.stringify(join(root, 'pantry'))}, port: 0, catalog: packages, run: async (args) => { await Bun.sleep(20); return args.at(-1) === packages[3].domain ? 7 : 0 } })
const baseUrl = 'http://127.0.0.1:' + service.server.port
const token = await new PantryDesktopClient({ baseUrl }).pair(createDesktopPairingCode(${JSON.stringify(join(root, 'pantry'))}), 'Usage fixture')
export const shutdown = async () => { await stopUsage(); await service.close() }
export default async (request: Request) => await updates(request) ?? await pantryApi(request, { onJobs: api.recordPantryJobs, fetch: (target, init) => {
  const headers = new Headers(init?.headers)
  headers.set('authorization', 'Bearer ' + token)
  return fetch(baseUrl + new URL(String(target)).pathname, { ...init, headers })
} }) ?? await api(request) ?? await modelApi(request)
`)
  const template = join(root, 'app.stx')
  await Bun.write(template, '<html><body>Usage qualification</body></html>')
  const built = await buildNative({ input: template, output: root, target: 'macos', name: 'UsageFixture', craftPath, runtimeProfile: 'webview', backend: { entry } })
  assert.ok(built.success, built.error || 'Native build failed.')
  const backend = Bun.spawn([join(built.outputPath!, 'Contents/MacOS/stx-backend'), '--serve', '--managed'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  child = backend
  const first = await Promise.race([backend.stdout.getReader().read(), Bun.sleep(5000).then(() => { throw new Error('Native backend did not become ready.') })])
  const ready = new TextDecoder().decode(first.value ?? new Uint8Array()).trim()
  const origin = new URL(ready).origin
  const login = await fetch(ready, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
  assert.equal(login.status, 303)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  const request = async (path: string, body?: unknown) => {
    const response = await fetch(`${origin}/api/${path}`, { signal: AbortSignal.timeout(5000), method: body ? 'POST' : 'GET', headers: { cookie, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    assert.ok(response.ok, `API status ${response.status}`)
    return response.status === 204 ? null : await response.json()
  }
  assert.equal((await fetch(`${origin}/api/updates`)).status, 403)
  assert.equal((await request('updates')).phase, 'idle')
  const event = (action: string, kind = 'launcher') => ({ eventId: crypto.randomUUID(), action, kind, applicationName: kind === 'application' ? 'Calculator' : '', occurredAt: Date.now(), timezoneOffset: new Date().getTimezoneOffset(), durationMs: 0 })
  await request('activity-events', event('palette_opened'))
  await request('activity-events', event('palette_opened'))
  await Bun.sleep(150)
  await request('activity-events', event('command_executed', 'application'))
  await request('activity-events', event('command_executed', 'quicklink'))
  await request('activity-events', event('link_opened', 'pantry'))
  await request('activity-events', event('palette_dismissed'))
  await request('activity-events', event('palette_dismissed'))
  const visible = (await request('activity-summary')).data
  await Bun.sleep(150)
  const hidden = (await request('activity-summary')).data
  assert.equal(hidden.sessions, 1)
  assert.equal(hidden.paletteOpens, 1)
  assert.equal(hidden.applicationsOpened, 1)
  assert.equal(hidden.linksOpened, 2)
  assert.ok(hidden.runningMs > visible.runningMs)
  assert.equal(hidden.visibleMs, visible.visibleMs)
  assert.ok(hidden.visibleMs >= 150)
  for (const item of packages) {
    const submitted = await request('pantry/desktop/v1/install', { domain: item.domain, requestId: crypto.randomUUID() })
    let job = submitted.job
    for (let index = 0; index < 100 && ['queued', 'running'].includes(job.status); index++) {
      await Bun.sleep(10)
      job = (await request(`pantry/desktop/v1/jobs/${job.id}`)).job
    }
    assert.ok(['succeeded', 'failed'].includes(job.status))
  }
  await request('pantry/desktop/v1/jobs')
  await request('pantry/desktop/v1/jobs')
  const pantry = (await request('activity-summary')).data.pantry
  assert.equal(pantry.installed, 3)
  assert.equal(pantry.failed, 1)
  assert.deepEqual(pantry.byKind, { app: 1, cli: 1, library: 1, font: 0 })
  assert.equal(pantry.timedInstalls, 3)
  assert.equal((await request('pantry-installations')).data.length, 4)
  backend.stdin.end()
  assert.equal(await Promise.race([backend.exited, Bun.sleep(5000).then(() => 'timeout')]), 0)
  const db = new Database(database, { readonly: true })
  assert.equal((db.query("select count(*) as count from launcher_activitys where action = 'session_ended'").get() as { count: number }).count, 1)
  assert.equal((db.query('select count(*) as count from pantry_installations').get() as { count: number }).count, 4)
  const time = db.query('select sum(running_ms) as running, sum(visible_ms) as visible from launcher_usage_days').get()
  db.close()
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ authenticatedNativeApi: true, sessions: hidden.sessions, paletteOpens: hidden.paletteOpens, applicationsOpened: hidden.applicationsOpened, linksOpened: hidden.linksOpened, hiddenTimeExcludedFromVisible: true, gracefulFinalCheckpoint: true, pantry, time }))
}
finally {
  if (child && child.exitCode === null) {
    child.kill()
    await child.exited
  }
  rmSync(root, { recursive: true, force: true })
}
