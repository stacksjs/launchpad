import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'
import { launcherPage } from './launcher-page.mjs'
const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
const html = launcherPage(source)
assert.notEqual(html, source)
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
const apps = Array.from({ length: 2000 }, (_, index) => ({ key: `/Applications/Fixture${index}.app`, content: `/Applications/Fixture${index}.app`, title: `Fixture app ${String(index).padStart(4, '0')}`, subtitle: 'Application', kind: 'application' }))
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 }, colorScheme: process.env.LAUNCHPAD_UI_DARK ? 'dark' : 'light' })
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  let releaseRanking = () => {}
  const ranking = new Promise(resolve => { releaseRanking = resolve })
  await page.addInitScript(factory => {
    const bridge = (0, eval)(`(${factory})`)(['window', 'app', 'shell', 'serviceMenu'])
    window.__bridge = bridge
    window.__launchEffects = []
    bridge.whenCalled('app', 'icon', null)
    bridge.whenCalled('serviceMenu', 'register', { ok: true })
    bridge.whenCalled('window', 'hide', async () => { window.__launchEffects.push('hide') })
    bridge.whenCalled('shell', 'openPath', async () => {
      window.__launchEffects.push('open-request')
      await new Promise((resolve, reject) => { window.__acceptLaunch = resolve; window.__refuseLaunch = reject })
      window.__launchEffects.push('accepted')
    })
  }, installMockBridge.toString())
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (path === '/api/ranking') { await ranking; return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: { launches: 5, lastUsed: Date.now() } }) }) }
    if (path === '/api/applications') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: apps }) })
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(apps => {
    const s = window.__launcher
    s.items.set(apps); s.loading.set(false); s.paletteVisible.set(true)
    s.colorMode.set(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); s.applyTheme()
    s.records.set({ [apps[1900].key]: { launches: 2, lastUsed: Date.now() }, [apps[1800].key]: { favorite: true, launches: 1 } })
  }, apps)
  await page.getByRole('heading', { name: 'Suggested', exact: true }).waitFor()
  assert.equal(await page.locator('#result-0 .result-title').textContent(), 'Fixture app 1800')
  assert.equal(await page.locator('#result-1 .result-title').textContent(), 'Fixture app 1900')
  assert.equal(await page.evaluate(() => new Set(window.__launcher.results().map(item => item.key)).size), 2000)
  assert.equal(await page.getByRole('button', { name: /^Show \d+ more$/ }).count(), 0)
  assert.ok(await page.getByRole('option').count() <= 16, 'The complete catalog must not become a complete DOM tree.')
  await page.locator('#result-0').click()
  await page.waitForFunction(() => window.__launchEffects.includes('open-request'))
  assert.deepEqual(await page.evaluate(() => window.__launchEffects), ['hide', 'open-request'])
  assert.equal(await page.evaluate(() => window.__launcher.paletteVisible()), false, 'The palette is dismissed before a cold launch acknowledges.')
  // Reopening during a launch cannot be undone by that launch's late success.
  await page.evaluate(() => { window.__launcher.paletteVisible.set(true); window.__acceptLaunch() })
  await page.waitForFunction(() => !window.__launcher.saving())
  assert.equal(await page.evaluate(() => window.__launcher.paletteVisible()), true)
  assert.deepEqual(await page.evaluate(() => window.__launchEffects), ['hide', 'open-request', 'accepted'])
  assert.equal(await page.evaluate(() => window.__launcher.saving()), false, 'An unresolved ranking write cannot block the next command.')
  await page.evaluate(() => { window.__launcher.category.set('application'); window.__launcher.query.set('') })
  await page.getByRole('combobox', { name: 'Search applications and commands' }).press('End')
  await page.waitForFunction(() => window.__launcher.selected() === 1999)
  await page.locator('#result-1999').waitFor({ state: 'visible' })
  assert.ok(await page.getByRole('option').count() <= 16)
  await page.getByRole('combobox', { name: 'Search applications and commands' }).fill('Fixture app 1998')
  await page.waitForFunction(() => window.__launcher.results().length === 1)
  assert.equal(await page.locator('#result-0 .result-title').textContent(), 'Fixture app 1998')
  releaseRanking()
  assert.deepEqual(errors, [])
  if (process.env.LAUNCHPAD_SUGGESTED_SCREENSHOT) {
    await page.evaluate(() => { const s = window.__launcher; s.category.set('all'); s.query.set(''); s.resetResultPosition() })
    await page.getByRole('heading', { name: 'Suggested', exact: true }).waitFor()
    await page.screenshot({ path: process.env.LAUNCHPAD_SUGGESTED_SCREENSHOT })
  }
  console.log('Launcher acceptance passed: smart suggestions, no duplicates, full 2000-result scrolling, bounded DOM, hide before cold launch, late acknowledgement and stalled ranking persistence.')
}
finally { await browser.close() }
