import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'

const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
assert.ok(source.includes('return { get "actionLabel"()'))
const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 }, colorScheme: process.env.LAUNCHPAD_UI_DARK ? 'dark' : 'light' })
  const errors = []
  const requests = []
  let jobs = []
  let inventory = []
  let unavailable = false
  page.on('pageerror', error => errors.push(error.stack || String(error)))
  await page.addInitScript(factory => { const bridge = (0, eval)(`(${factory})`)(['window', 'app', 'serviceMenu']); bridge.whenCalled('serviceMenu', 'register', { ok: true }) }, installMockBridge.toString())
  await page.route('**/*', async route => {
    const path = new URL(route.request().url()).pathname
    const respond = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (/^\/api\/pantry\/desktop\/v1\/(uninstall|install)$/.test(path)) {
      const body = route.request().postDataJSON()
      const operation = path.endsWith('/uninstall') ? 'uninstall' : 'install'
      requests.push({ ...body, operation })
      if (unavailable) return respond({ error: 'Fixture service unavailable' }, 503)
      const job = { ...body, operation, id: crypto.randomUUID(), status: 'queued', createdAt: new Date().toISOString(), output: '' }
      jobs = [job]
      return respond({ job }, 202)
    }
    if (path === '/api/pantry/desktop/v1/jobs') return respond({ jobs })
    if (path === '/api/pantry/desktop/v1/installed') return respond({ packages: inventory })
    if (path.startsWith('/api/')) return respond({ data: [] })
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(dark => {
    const s = window.__launcher
    s.colorMode.set(dark ? 'dark' : 'light')
    s.applyTheme()
    const kinds = ['app', 'cli', 'library', 'font']
    const catalog = kinds.map(kind => ({ domain: `${kind}.example`, name: `Fixture ${kind}`, description: 'Package management fixture', kind, aliases: [], programs: [], latestVersion: '2', homepageUrl: null, githubUrl: null, platforms: null, logo: null }))
    s.catalog.set(catalog)
    s.pantryInstalled.set(catalog.map(entry => ({ name: entry.domain, version: '1', managed: true, ...(entry.kind === 'app' ? { applicationPath: '/Users/test/Applications/Fixture.app' } : {}) })))
    s.pantryCapabilities.set(['uninstall:user'])
    s.pantryReady.set(true)
    s.paletteVisible.set(true)
    s.loading.set(false)
    s.category.set('pantry')
  }, Boolean(process.env.LAUNCHPAD_UI_DARK))
  await page.evaluate(() => window.__launcher.applyTheme())
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), Boolean(process.env.LAUNCHPAD_UI_DARK))
  await page.getByLabel('Pantry view').selectOption('installed')
  assert.equal(await page.evaluate(() => window.__launcher.allResults().length), 4)
  await page.getByLabel('Package type').selectOption('font')
  assert.deepEqual(await page.evaluate(() => window.__launcher.allResults().map(item => item.package.kind)), ['font'])
  await page.getByLabel('Package type').selectOption('all')
  await page.evaluate(() => { const s = window.__launcher; const entry = s.catalog()[0]; s.packageDetail.set({ key: 'pantry:' + entry.domain, title: entry.name, kind: 'pantry', content: entry.domain, package: entry }) })
  const details = page.getByRole('dialog', { name: 'Pantry package details', exact: true })
  await details.getByRole('button', { name: 'Uninstall', exact: true }).click()
  const confirmation = page.getByRole('alertdialog')
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  await confirmation.waitFor({ state: 'detached' })
  assert.equal(requests.length, 0, 'Cancelling uninstall must not send a request')
  await details.getByRole('button', { name: 'Uninstall', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Uninstall', exact: true }).click()
  await confirmation.waitFor({ state: 'detached' })
  await page.waitForFunction(() => window.__launcher.installJob()?.status === 'queued')
  assert.equal(requests[0].operation, 'uninstall')
  assert.equal(await details.getByRole('button', { name: 'Open Fixture app', exact: true }).isDisabled(), true)
  assert.equal(await details.getByRole('button', { name: 'Queued…', exact: true }).isDisabled(), true)
  jobs = jobs.map(job => ({ ...job, status: 'failed', error: 'Quit Fixture before uninstalling it.', output: 'Fixture running' }))
  await page.evaluate(() => window.__launcher.pollInstall())
  await details.getByText('Quit Fixture before uninstalling it.', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Pantry operation output').isVisible(), false)
  await details.getByRole('button', { name: 'Retry uninstall', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Uninstall', exact: true }).click()
  await confirmation.waitFor({ state: 'detached' })
  await page.waitForFunction(() => !window.__launcher.packageBusy())
  assert.equal(requests.length, 2)
  assert.notEqual(requests[0].requestId, requests[1].requestId, 'A known failed operation gets a new request ID')
  jobs = jobs.map(job => ({ ...job, status: 'running' }))
  await page.evaluate(() => window.__launcher.pollInstall())
  await details.getByText('Uninstall in progress', { exact: true }).waitFor()
  inventory = []
  jobs = jobs.map(job => ({ ...job, status: 'succeeded', output: 'Moved managed files to Trash' }))
  await page.evaluate(() => window.__launcher.pollInstall())
  await details.getByText('Uninstalled', { exact: true }).waitFor()
  assert.equal(await details.getByRole('button', { name: 'Open Fixture app', exact: true }).count(), 0)
  assert.equal(await details.getByRole('button', { name: 'Uninstall', exact: true }).count(), 0)
  await details.getByRole('button', { name: 'Install', exact: true }).click()
  await page.waitForFunction(() => !window.__launcher.packageBusy())
  assert.equal(requests.at(-1).operation, 'install', 'A removed package can be installed again')
  assert.notEqual(requests.at(-1).requestId, requests.at(-2).requestId)
  // An older service must keep working, while making its missing capability clear.
  await page.evaluate(() => { const s = window.__launcher; s.installJobs.set([]); s.pantryInstalled.set([{ name: 'app.example', version: '1', managed: true, applicationPath: '/Users/test/Applications/Fixture.app' }]); s.pantryCapabilities.set([]) })
  assert.equal(await details.getByRole('button', { name: 'Uninstall', exact: true }).isDisabled(), true)
  await details.getByText('Update Pantry Desktop to enable uninstall, then refresh the connection.', { exact: true }).waitFor()
  // Unknown catalog entries remain removable; foreign apps remain openable.
  await page.evaluate(() => { const s = window.__launcher; s.pantryCapabilities.set(['uninstall:user']); s.pantryInstalled.set([{ name: 'orphan.example', version: '1', managed: true }]); s.packageDetail.set(s.searchPackages()('orphan.example')[0]) })
  await details.getByRole('button', { name: 'Uninstall', exact: true }).waitFor()
  assert.equal(await details.getByRole('button', { name: 'Not in catalog', exact: true }).isDisabled(), true)
  unavailable = true
  for (let i = 0; i < 2; i++) {
    await details.getByRole('button', { name: 'Uninstall', exact: true }).click()
    await confirmation.getByRole('button', { name: 'Uninstall', exact: true }).click()
    await confirmation.waitFor({ state: 'detached' })
    await page.waitForFunction(() => !window.__launcher.packageBusy())
  }
  assert.equal(requests.at(-1).requestId, requests.at(-2).requestId, 'Uncertain uninstall retries retain their request ID')
  assert.equal(requests.at(-1).operation, 'uninstall')
  await page.evaluate(() => { const s = window.__launcher; s.packageError.set(''); s.pantryInstalled.set([{ name: 'app.example', version: '1', managed: false, applicationPath: '/Applications/Fixture.app' }]); const entry = s.catalog()[0]; s.packageDetail.set({ key: 'pantry:' + entry.domain, title: entry.name, kind: 'pantry', content: entry.domain, package: entry }) })
  await details.getByText('Installed outside Pantry', { exact: true }).waitFor()
  assert.equal(await details.getByRole('button', { name: 'Uninstall', exact: true }).count(), 0)
  assert.equal(await details.getByRole('button', { name: 'Open Fixture app', exact: true }).isEnabled(), true)
  await page.evaluate(() => { const s = window.__launcher; s.pantryInstalled.set([{ name: 'app.example', version: '1', managed: true, applicationPath: '/Users/test/Applications/Fixture.app' }]) })
  for (const width of [720, 480]) {
    await page.setViewportSize({ width, height: 450 })
    const buttons = await details.locator('.package-actions button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom } }))
    assert.ok(buttons.every(r => r.left >= 0 && r.right <= width && r.bottom <= 450), 'Management actions fit the window')
  }
  await page.setViewportSize({ width: 720, height: 450 })
  if (process.env.LAUNCHPAD_PANTRY_SCREENSHOT) await page.screenshot({ path: process.env.LAUNCHPAD_PANTRY_SCREENSHOT.replace('.png', '-management.png') })
  unavailable = false
  await details.getByRole('button', { name: 'Reinstall latest', exact: true }).click()
  await page.waitForFunction(() => !window.__launcher.packageBusy())
  assert.equal(requests.at(-1).operation, 'install', 'Reinstall latest submits an installation job')
  assert.deepEqual(errors, [])
  console.log('Pantry management acceptance passed: installed filters, cancel, queue, removal, retries, reinstall, external apps, legacy service and responsive actions.')
}
finally { await browser.close() }
