import { strict as assert } from 'node:assert'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Database } from 'bun:sqlite'
import { buildNative } from '@stacksjs/stx/craft'
const app = resolve(import.meta.dir, '..')
const craftPath = process.env.CRAFT_BIN || Bun.which('craft-webview')
if (!craftPath) throw new Error('Activate the Pantry Craft runtime or set CRAFT_BIN before native qualification.')
const root = mkdtempSync(join(tmpdir(), 'launchpad-usage-qualified-'))
let child: ReturnType<typeof Bun.spawn> | undefined
try {
  const database = join(root, 'usage.sqlite')
  const entry = join(root, 'api.ts')
  await Bun.write(entry, `import { openNativeDatabase, createNativeModelApi } from ${JSON.stringify(Bun.resolveSync('@stacksjs/orm/native', app))}
import LauncherActivity from '${app}/app/Models/LauncherActivity.ts'
import LauncherUsageDay from '${app}/app/Models/LauncherUsageDay.ts'
import AppPreference from '${app}/app/Models/AppPreference.ts'
import { createActivityApi, startActivityRuntime } from '${app}/app/Desktop/activity.ts'
const models = { LauncherActivity, LauncherUsageDay, AppPreference }
openNativeDatabase({ path: ${JSON.stringify(database)}, models })
const modelApi = createNativeModelApi({ models, authorize: () => true })
const api = createActivityApi(modelApi)
export const shutdown = startActivityRuntime(api)
export default async (request: Request) => await api(request) ?? await modelApi(request)
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
  backend.stdin.end()
  assert.equal(await Promise.race([backend.exited, Bun.sleep(5000).then(() => 'timeout')]), 0)
  const db = new Database(database, { readonly: true })
  assert.equal((db.query("select count(*) as count from launcher_activitys where action = 'session_ended'").get() as { count: number }).count, 1)
  const time = db.query('select sum(running_ms) as running, sum(visible_ms) as visible from launcher_usage_days').get()
  db.close()
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ authenticatedNativeApi: true, sessions: hidden.sessions, paletteOpens: hidden.paletteOpens, applicationsOpened: hidden.applicationsOpened, linksOpened: hidden.linksOpened, hiddenTimeExcludedFromVisible: true, gracefulFinalCheckpoint: true, time }))
}
finally {
  if (child && child.exitCode === null) {
    child.kill()
    await child.exited
  }
  rmSync(root, { recursive: true, force: true })
}
