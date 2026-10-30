import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'

const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
assert.ok(source.includes('return { get "actionLabel"()') && source.includes('onMount(async () => {'))
const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 } })
  const errors = []
  const actions = []
  let state = { currentVersion: '1.0.10', phase: 'idle' }
  let offline = true
  let releaseStatus = () => {}
  const slowStatus = new Promise(resolve => { releaseStatus = resolve })
  page.on('pageerror', error => errors.push(String(error)))
  await page.addInitScript(factory => { (0, eval)(`(${factory})`)(['window', 'app']) }, installMockBridge.toString())
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://localhost') return route.abort()
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (url.pathname.startsWith('/api/updates')) {
      if (route.request().method() === 'GET') {
        const snapshot = JSON.stringify(state)
        await slowStatus
        return route.fulfill({ contentType: 'application/json', body: snapshot })
      }
      if (route.request().method() === 'POST') {
        const action = url.pathname.split('/').pop()
        actions.push(action)
        if (action === 'check') state = offline ? { ...state, phase: 'error', error: 'Network unavailable' } : { currentVersion: state.currentVersion, phase: 'available', version: '1.0.11' }
        if (action === 'download') state = { ...state, phase: 'ready', percent: 100 }
        if (action === 'install') state = { ...state, phase: 'installed' }
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) })
    }
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(() => {
    const s = window.__launcher
    s.settings.set(true); s.settingsSection.set('general'); s.paletteVisible.set(true)
  })
  const statusRead = page.waitForRequest(request => new URL(request.url()).pathname === '/api/updates')
  await page.evaluate(() => { window.__pendingStatus = window.__launcher.refreshUpdate() })
  await statusRead
  await page.getByRole('button', { name: 'Check for Updates...', exact: true }).click()
  await page.getByText('Network unavailable', { exact: true }).waitFor()
  releaseStatus()
  await page.evaluate(() => window.__pendingStatus)
  assert.equal(await page.getByText('Network unavailable', { exact: true }).count(), 1, 'A stale status read cannot overwrite a newer check.')
  assert.equal(await page.getByText('You are up to date.', { exact: true }).count(), 0)
  offline = false
  await page.getByRole('button', { name: 'Check for Updates...', exact: true }).click()
  await page.getByText('Launchpad 1.0.11 is available.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Download update', exact: true }).click()
  await page.getByRole('button', { name: 'Install and Restart', exact: true }).click()
  await page.getByText('Restarting Launchpad...', { exact: true }).waitFor()
  assert.deepEqual(actions, ['check', 'check', 'download', 'install'])
  assert.deepEqual(errors, [])
  process.stdout.write(JSON.stringify({ offlineCheckDoesNotClaimCurrent: true, retryDownloadInstallControls: true, frameworkEndpoint: true }) + '\n')
}
finally { await browser.close() }
