import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'
import { launcherPage } from './launcher-page.mjs'

const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
const html = launcherPage(source)
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 } })
  const errors = []
  const actions = []
  const preferenceWrites = []
  const preferenceOutcomes = []
  let savedPreference
  let state = { currentVersion: '1.0.10', phase: 'idle' }
  let offline = true
  let releaseStatus = () => {}
  const slowStatus = new Promise(resolve => { releaseStatus = resolve })
  page.on('pageerror', error => errors.push(String(error)))
  await page.addInitScript(factory => { const bridge = (0, eval)(`(${factory})`)(['window', 'app', 'serviceMenu']); bridge.whenCalled('serviceMenu', 'register', { ok: true }) }, installMockBridge.toString())
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
        if (action === 'download') state = { ...state, phase: 'downloading', percent: 37 }
        if (action === 'install') state = { ...state, phase: 'installed' }
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(state) })
    }
    if (url.pathname.startsWith('/api/preferences')) {
      const method = route.request().method()
      preferenceWrites.push(method)
      if (preferenceOutcomes.shift() === 'fail') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Could not save update settings.' }) })
      if (method === 'POST' && savedPreference) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'AppPreference already exists' }) })
      savedPreference = { id: 1, ...route.request().postDataJSON() }
      await new Promise(resolve => setTimeout(resolve, 30))
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: savedPreference }) })
    }
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  if (process.env.LAUNCHPAD_UI_DARK) await page.evaluate(() => { document.documentElement.classList.add('dark'); window.__launcher.applyTheme() })
  await page.evaluate(() => {
    const s = window.__launcher
    s.settings.set(true); s.settingsSection.set('updates'); s.paletteVisible.set(true)
  })
  const automaticUpdates = page.getByRole('switch', { name: 'Automatic Updates', exact: true })
  assert.equal(await automaticUpdates.isDisabled(), true, 'Wait for saved preferences before allowing changes.')
  await page.evaluate(() => window.__launcher.preferencesReady.set(true))
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
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByText('Launchpad 1.0.11 is available.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Download update', exact: true }).click()
  await page.getByText('37%', { exact: true }).waitFor()
  const progress = page.getByRole('progressbar', { name: 'Update download progress' })
  assert.equal(await progress.getAttribute('value'), '37')
  assert.equal(await page.locator('.update-card').getAttribute('aria-busy'), 'true')
  assert.equal(await page.getByRole('button', { name: 'Downloading…', exact: true }).count(), 0)
  const toggleBox = await automaticUpdates.boundingBox()
  const detailBox = await page.locator('.settings-detail').boundingBox()
  assert.ok(toggleBox.y + toggleBox.height <= detailBox.y + detailBox.height, 'Automatic updates stays visible alongside download progress.')
  if (process.env.LAUNCHPAD_UPDATE_SCREENSHOT) await page.screenshot({ path: process.env.LAUNCHPAD_UPDATE_SCREENSHOT })
  state = { ...state, percent: undefined }
  await page.evaluate(value => window.__launcher.updateState.set(value), state)
  await page.getByText('Preparing download…', { exact: true }).waitFor()
  assert.equal(await page.getByRole('progressbar', { name: 'Update download progress' }).getAttribute('aria-valuenow'), null)
  assert.equal(await page.getByText('0%', { exact: true }).count(), 0, 'Unknown progress must not pretend the download is at zero.')
  state = { ...state, phase: 'ready', percent: 100 }
  await page.evaluate(value => window.__launcher.updateState.set(value), state)
  await page.getByRole('button', { name: 'Install and Restart', exact: true }).click()
  await page.getByText('Restarting Launchpad...', { exact: true }).waitFor()
  assert.deepEqual(actions, ['check', 'check', 'download', 'install'])
  await page.getByRole('button', { name: 'General', exact: true }).click()
  await page.getByRole('button', { name: 'Software Update', exact: true }).last().waitFor()
  const settingsTitles = await page.locator('.settings-item').allTextContents()
  await page.getByRole('searchbox', { name: 'Search settings' }).fill('download')
  assert.equal(await page.locator('.settings-item').count(), 1)
  await page.getByRole('button', { name: 'Software Update', exact: true }).first().click()
  await page.getByRole('switch', { name: 'Automatic Updates', exact: true }).waitFor()
  await page.getByRole('searchbox', { name: 'Search settings' }).fill('no matching pane')
  await page.getByText('No settings found.', { exact: true }).waitFor()
  await page.getByRole('searchbox', { name: 'Search settings' }).fill('')
  assert.deepEqual(await page.locator('.settings-item').allTextContents(), settingsTitles, 'Clearing settings search restores every section.')
  await page.getByRole('button', { name: 'Usage', exact: true }).scrollIntoViewIfNeeded()
  assert.equal(await page.locator('.settings-nav').evaluate(nav => nav.scrollHeight > nav.clientHeight && nav.scrollTop > 0), true, 'Every sidebar section must remain reachable in the palette-sized window.')
  await page.evaluate(() => Promise.all([window.__launcher.changeAutomaticUpdates(false), window.__launcher.changeAutomaticUpdates(true)]))
  assert.deepEqual(preferenceWrites, ['POST', 'PATCH'], 'Rapid changes must reuse the first saved preference row.')
  assert.equal(JSON.parse(savedPreference.value).enabled, true)
  assert.equal(await page.getByText('AppPreference already exists', { exact: true }).count(), 0)
  preferenceOutcomes.push('fail')
  await automaticUpdates.click()
  await page.getByRole('dialog', { name: 'Launchpad Settings' }).getByText('Could not save update settings.', { exact: true }).waitFor()
  assert.equal(await automaticUpdates.isChecked(), true, 'A failed save restores the stored value.')
  preferenceOutcomes.push('success', 'fail')
  await page.evaluate(() => Promise.all([window.__launcher.changeAutomaticUpdates(false), window.__launcher.changeAutomaticUpdates(true)]))
  assert.equal(await automaticUpdates.isChecked(), false, 'A failed newer save restores the last successful value.')
  preferenceOutcomes.push('fail', 'fail')
  await page.evaluate(() => Promise.all([window.__launcher.changeAutomaticUpdates(true), window.__launcher.changeAutomaticUpdates(false)]))
  assert.equal(await automaticUpdates.isChecked(), false, 'Failed rapid changes restore the stored value, not another pending value.')
  assert.equal(JSON.parse(savedPreference.value).enabled, false)
  await page.evaluate(() => window.__launcher.updateState.set({ currentVersion: '1.0.10', phase: 'unavailable', error: 'Use the App Store to update this copy.' }))
  await page.getByText('Use the App Store to update this copy.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('switch', { name: 'Automatic Updates', exact: true }).count(), 0)
  await page.evaluate(() => { const s = window.__launcher; s.settings.set(false); s.query.set(''); s.category.set('all'); s.error.set(''); s.loading.set(false); s.items.set([{ key: 'sample:github', title: 'GitHub', kind: 'quicklink', content: 'https://github.com', subtitle: 'Quicklink' }]) })
  const header = page.locator('.palette-header')
  const box = await header.boundingBox()
  assert.ok(box.height <= 64, 'Search and actions share one compact header.')
  assert.equal(await page.getByRole('navigation', { name: 'Palette actions' }).evaluate(nav => nav.parentElement.tagName), 'HEADER')
  const inputBox = await page.getByRole('combobox', { name: 'Search applications and commands' }).boundingBox()
  const actionsBox = await page.getByRole('navigation', { name: 'Palette actions' }).boundingBox()
  assert.ok(Math.abs(inputBox.y + inputBox.height / 2 - actionsBox.y - actionsBox.height / 2) < 2)
  if (process.env.LAUNCHPAD_HEADER_SCREENSHOT) await page.screenshot({ path: process.env.LAUNCHPAD_HEADER_SCREENSHOT })
  await page.evaluate(() => window.__launcher.category.set('application'))
  for (const width of [720, 560, 420]) {
    await page.setViewportSize({ width, height: 450 })
    assert.ok((await page.getByRole('combobox', { name: 'Search applications and commands' }).boundingBox()).width > 100, 'The mode chip leaves room to type at narrow widths.')
    assert.equal(await header.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'Header controls must fit without wrapping or horizontal overflow.')
  }
  assert.deepEqual(errors, [])
  process.stdout.write(JSON.stringify({ offlineCheckDoesNotClaimCurrent: true, retryDownloadInstallControls: true, frameworkEndpoint: true }) + '\n')
}
finally { await browser.close() }
