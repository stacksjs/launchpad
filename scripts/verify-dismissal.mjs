import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'
import { bundledPackageCatalog } from 'ts-pantry/catalog'

const path = process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html'
const source = readFileSync(path, 'utf8')
assert.ok(source.includes('return { get "actionLabel"()') && source.includes('onMount(async () => {'))
const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
let release = () => {}
let gate
function holdWrites() { gate = new Promise(resolve => { release = resolve }) }
holdWrites()
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 } })
  const events = []
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.addInitScript((factory) => {
    window.__bridge = (0, eval)(`(${factory})`)(['shell', 'window'])
    window.__hidden = 0
    window.__bridge.whenCalled('window', 'hide', () => { window.__hidden++ })
    window.__bridge.whenCalled('shell', 'openPath', () => { if (window.__denyLaunch) throw new Error('Fixture launch denied') })
  }, installMockBridge.toString())
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://localhost') return route.abort()
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (url.pathname === '/api/activity-events') {
      const body = route.request().postDataJSON()
      events.push(body)
      await gate
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: body }) }).catch(() => {})
    }
    if (url.pathname.startsWith('/api/launch-records')) {
      const body = route.request().postDataJSON()
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { ...body, id: 1 } }) })
    }
    if (url.pathname === '/api/applications') return route.fulfill({ contentType: 'application/json', body: '{"data":[]}' })
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  const app = { key: '/Applications/Fixture Mail.app', title: 'Fixture Mail', kind: 'application', subtitle: 'Application', content: '/Applications/Fixture Mail.app', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' }
  await page.evaluate((app) => {
    const scope = window.__launcher
    window.batch(() => { scope.items.set([app]); scope.loading.set(false); scope.paletteVisible.set(true); scope.preferencesReady.set(true) })
    window.__run = scope.run(app)
  }, app)
  await page.waitForFunction(() => window.__hidden === 1 && !window.__launcher.saving())
  assert.equal(await page.evaluate(() => window.__launcher.error()), '')
  const pendingUsage = await page.evaluate(() => ({ pending: window.__launcher.usagePending(), queue: window.__launcher.usageQueue.length, ready: window.__launcher.preferencesReady(), enabled: window.__launcher.usageEnabled(), clearing: window.__launcher.usageClearing, issue: window.__launcher.usageIssue(), calls: window.__bridge.calls }))
  assert.ok(pendingUsage.pending > 0, 'Usage writes must still be blocked when the window hides and the launch completes: ' + JSON.stringify({ ...pendingUsage, events }))
  assert.equal(await page.evaluate(key => window.__launcher.records()[key]?.launches, app.key), 1)
  release()
  await page.waitForFunction(() => window.__launcher.usagePending() === 0)
  assert.equal(events.filter(event => event.action === 'command_executed').length, 1)

  await page.evaluate(async (app) => {
    window.__denyLaunch = true
    window.__launcher.paletteVisible.set(true)
    await window.__launcher.run(app)
  }, app)
  assert.equal(await page.evaluate(() => window.__hidden), 1, 'A denied launch must keep the launcher open.')
  assert.match(await page.evaluate(() => window.__launcher.error()), /Fixture launch denied/)
  assert.equal(events.filter(event => event.action === 'command_executed').length, 1)

  holdWrites()
  const entry = bundledPackageCatalog().find(entry => entry.kind === 'app')
  await page.evaluate(({ entry, app }) => {
    const scope = window.__launcher
    window.__denyLaunch = false
    scope.pantryInstalled.set([{ name: entry.domain, version: '1', applicationPath: app.content }])
    scope.packageDetail.set({ key: `pantry:${entry.domain}`, title: entry.name, kind: 'pantry', content: entry.domain, package: entry, subtitle: '' })
    window.__detailsRun = scope.openPackageApplication()
  }, { entry, app })
  await page.waitForFunction(() => window.__hidden === 2)
  await page.evaluate(() => window.__detailsRun)
  assert.ok(await page.evaluate(() => window.__launcher.usagePending() > 0))
  release()
  await page.waitForFunction(() => window.__launcher.usagePending() === 0)
  const commands = events.filter(event => event.action === 'command_executed')
  assert.equal(commands.length, 2)
  assert.equal(new Set(events.map(event => event.eventId)).size, events.length)
  assert.ok(commands.every(event => event.kind === 'application'))
  assert.deepEqual(errors, [])
  process.stdout.write(JSON.stringify({ launcherHiddenBeforeUsagePersistence: true, rankingSaved: true, deniedLaunchStaysVisible: true, pantryDetailsHiddenBeforeUsagePersistence: true, successfulCommands: commands.length }) + '\n')
}
finally { release(); await browser.close() }
