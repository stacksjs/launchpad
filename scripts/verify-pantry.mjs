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
  const requests = []
  page.on('pageerror', error => errors.push(error.stack || String(error)))
  await page.addInitScript(factory => { const bridge = (0, eval)(`(${factory})`)(['window', 'app', 'serviceMenu']); bridge.whenCalled('serviceMenu', 'register', { ok: true }) }, installMockBridge.toString())
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://localhost' && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (url.pathname === '/api/pantry/desktop/v1/install') {
      requests.push(route.request().postDataJSON())
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Pantry service is unavailable' }) })
    }
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(() => {
    const s = window.__launcher
    const entry = { domain: 'github.com/desktop', name: 'GitHub Desktop', description: 'A desktop application for contributing to projects on GitHub.', kind: 'app', aliases: ['gh-desktop'], programs: ['github-desktop'], latestVersion: '3.5.12', homepageUrl: 'https://desktop.github.com', githubUrl: null, platforms: ['darwin'], logo: null }
    const job = { id: crypto.randomUUID(), requestId: crypto.randomUUID(), domain: entry.domain, status: 'succeeded', createdAt: new Date().toISOString(), output: 'Package downloaded into Pantry storage' }
    s.paletteVisible.set(true)
    s.pantryReady.set(true)
    s.pantryInstalled.set([{ name: entry.domain, version: '3.5.12' }])
    s.installJobs.set([job])
    s.packageDetail.set({ key: 'pantry:' + entry.domain, title: entry.name, subtitle: '', kind: 'pantry', content: entry.domain, package: entry })
  })
  await page.getByRole('button', { name: 'Repair installation', exact: true }).waitFor()
  assert.equal(await page.getByText('Mac application · github.com/desktop', { exact: true }).count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Installed', exact: true }).count(), 0)
  assert.equal(await page.getByLabel('Pantry installation output').isVisible(), false, 'Logs begin collapsed')
  await page.getByText('Installation details', { exact: true }).click()
  assert.equal(await page.getByLabel('Pantry installation output').isVisible(), true)
  await page.getByRole('button', { name: 'Repair installation', exact: true }).click()
  await page.getByText('Pantry service is unavailable', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Repair installation', exact: true }).isEnabled(), true)
  await page.getByRole('button', { name: 'Repair installation', exact: true }).click()
  await page.waitForFunction(() => !window.__launcher.packageBusy())
  assert.equal(requests.length, 2)
  assert.equal(requests[0].requestId, requests[1].requestId, 'Retrying an uncertain request must retain its deduplication key')
  await page.evaluate(() => {
    const s = window.__launcher
    s.packageError.set('')
    s.installJobs.set(s.installJobs().map(job => ({ ...job, status: 'queued' })))
  })
  assert.equal(await page.getByRole('button', { name: 'Queued…', exact: true }).isDisabled(), true)
  await page.evaluate(() => {
    const s = window.__launcher
    s.installJobs.set(s.installJobs().map(job => ({ ...job, status: 'running' })))
  })
  assert.equal(await page.getByRole('button', { name: 'Installing…', exact: true }).isDisabled(), true)
  await page.evaluate(() => {
    const s = window.__launcher
    s.installJobs.set(s.installJobs().map(job => ({ ...job, status: 'succeeded' })))
    s.pantryInstalled.set([{ name: 'github.com/desktop', version: '3.5.12', applicationPath: '/Users/test/Applications/GitHub Desktop.app' }])
  })
  await page.getByRole('button', { name: 'Open GitHub Desktop', exact: true }).waitFor()
  await page.getByText('Ready to open', { exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Repair installation', exact: true }).count(), 0)
  if (process.env.LAUNCHPAD_PANTRY_SCREENSHOT) await page.screenshot({ path: process.env.LAUNCHPAD_PANTRY_SCREENSHOT })
  assert.deepEqual(errors, [])
  console.log('Pantry UI acceptance passed: missing bundle, repair, collapsed logs, request failure, queue, install, and Open application.')
}
finally { await browser.close() }
