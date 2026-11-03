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
  const preferenceWrites = []
  const preferenceOutcomes = []
  let savedPreference
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
  await page.getByRole('button', { name: 'Check for Updates...', exact: true }).click()
  await page.getByText('Launchpad 1.0.11 is available.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Download update', exact: true }).click()
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
  assert.deepEqual(errors, [])
  process.stdout.write(JSON.stringify({ offlineCheckDoesNotClaimCurrent: true, retryDownloadInstallControls: true, frameworkEndpoint: true }) + '\n')
}
finally { await browser.close() }
