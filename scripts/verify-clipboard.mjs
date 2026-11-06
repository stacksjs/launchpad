import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'

const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
assert.ok(source.includes('return { get "actionLabel"()') && source.includes('onMount(async () => {'))
const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 }, colorScheme: process.env.LAUNCHPAD_UI_DARK ? 'dark' : 'light' })
  const errors = []
  const writes = []
  const now = Date.now() - 60000
  let rows = [
    { id: 1, content: 'Alpha older copy', capturedAt: now - 120000, sourceApp: 'com.apple.Notes' },
    { id: 2, content: 'Middle copy\n' + 'More text\n'.repeat(20) + 'Résumé launch checklist', capturedAt: now - 60000, sourceApp: 'com.apple.Safari' },
    { id: 3, content: 'Zulu latest copy', capturedAt: now, sourceApp: 'com.apple.TextEdit' },
  ]
  let failWrite = false
  page.on('pageerror', error => errors.push(error.stack || String(error)))
  await page.addInitScript(factory => {
    const bridge = (0, eval)(`(${factory})`)(['window', 'app', 'serviceMenu', 'clipboard'])
    window.__bridge = bridge
    bridge.whenCalled('serviceMenu', 'register', { ok: true })
    bridge.whenCalled('clipboard', 'readText', 'A manually saved copy')
  }, installMockBridge.toString())
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    if (url.origin !== 'http://localhost') return route.abort()
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    const respond = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) })
    if (url.pathname === '/api/clipboard-entries') {
      if (method === 'GET') return respond(rows)
      const body = route.request().postDataJSON()
      writes.push(body)
      if (failWrite) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Clipboard storage unavailable' }) })
      await new Promise(resolve => setTimeout(resolve, 40))
      const row = { id: Math.max(...rows.map(row => row.id), 0) + 1, ...body }
      rows.push(row)
      return respond(row)
    }
    if (url.pathname.startsWith('/api/clipboard-entries/') && method === 'DELETE') {
      rows = rows.filter(row => row.id !== Number(url.pathname.split('/').pop()))
      return route.fulfill({ status: 204 })
    }
    if (url.pathname === '/api/applications') return respond([])
    if (['/api/commands', '/api/extensions', '/api/launch-records'].includes(url.pathname)) return respond([])
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(() => {
    const s = window.__launcher
    s.loading.set(false); s.chooseCategory('clipboard')
    s.records.set({ 'clipboard:1': { favorite: true, launches: 999, lastUsed: Date.now() } })
  })
  await page.evaluate(() => window.__launcher.reloadHistory())
  assert.deepEqual(await page.evaluate(() => window.__launcher.results().map(row => row.id)), [3, 2, 1])
  await page.getByText('Newest first · 3 entries', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Selected clipboard text').textContent(), rows[2].content)
  assert.match(await page.locator('#result-0 .result-subtitle').textContent(), /Today · .*TextEdit/)
  const search = page.getByRole('combobox', { name: 'Search clipboard history' })
  await search.fill('resume checklist')
  await page.getByText('Newest first · 1 match', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Selected clipboard text').textContent(), rows[1].content)
  await search.fill('Safari')
  assert.deepEqual(await page.evaluate(() => window.__launcher.results().map(row => row.id)), [2])
  await search.fill('no-such-saved-text')
  await page.getByText('No matching clipboard text.', { exact: true }).waitFor()
  assert.equal(await page.getByText('Enable history below to record new text, or save the current clipboard yourself.', { exact: true }).count(), 0)
  await search.fill('')
  await search.press('ArrowDown')
  assert.equal(await page.evaluate(() => window.__launcher.active().id), 2)
  rows.push({ id: 4, content: 'A new live copy', capturedAt: now + 1000, sourceApp: 'com.apple.Notes' })
  await page.evaluate(() => window.__launcher.reloadHistory())
  assert.equal(await page.evaluate(() => window.__launcher.active().id), 2, 'A live capture keeps the preview on the older selected entry.')
  assert.equal(await page.evaluate(() => window.__launcher.selected()), 2)
  await page.getByRole('button', { name: 'Delete selected saved item' }).click()
  await page.waitForFunction(() => window.__launcher.active()?.id === 1)
  assert.deepEqual(await page.evaluate(() => window.__launcher.results().map(row => row.id)), [4, 3, 1])
  await page.evaluate(() => window.__launcher.resetResultPosition())
  rows.push({ id: 5, content: 'Newest again', capturedAt: now + 2000, sourceApp: 'com.apple.Safari' })
  await page.evaluate(() => window.__launcher.reloadHistory())
  assert.equal(await page.evaluate(() => window.__launcher.active().id), 5, 'The first row follows incoming copies.')

  // Repeated manual saves and the watcher must share one write, including simultaneous callbacks.
  await page.getByRole('button', { name: 'Save current clipboard', exact: true }).click()
  await page.waitForFunction(() => !window.__launcher.historySaving())
  assert.equal(writes.length, 1)
  assert.equal(await page.evaluate(() => window.__launcher.active().content), 'A manually saved copy')
  await page.getByRole('button', { name: 'Save current clipboard', exact: true }).click()
  await page.waitForFunction(() => !window.__launcher.historySaving())
  assert.equal(writes.length, 1, 'Saving the latest clipboard text again creates no duplicate.')
  await page.evaluate(async () => {
    const s = window.__launcher
    window.__bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 4, text: 'A simultaneous capture', sourceBundleId: 'com.apple.Notes', blocked: false })
    s.historyEnabled.set(true)
    await Promise.all([s.pollClipboard(), s.saveHistoryText('A simultaneous capture')])
    window.__bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 5, text: null, blocked: true })
    await s.pollClipboard()
    s.historyEnabled.set(false)
  })
  assert.equal(writes.length, 2, 'The watcher and a manual save cannot duplicate a copy; protected content remains skipped.')
  failWrite = true
  await page.evaluate(async () => { try { await window.__launcher.saveHistoryText('Retry this capture') } catch {} })
  failWrite = false
  await page.evaluate(() => window.__launcher.saveHistoryText('Retry this capture'))
  assert.equal(writes.length, 4, 'A failed save does not poison later captures.')

  // Include enough data to exercise paging and virtual rows, then refresh while reviewing past the initial page.
  rows = Array.from({ length: 200 }, (_, index) => ({ id: index + 1, content: `Copy ${index + 1}\nSaved text for review`, capturedAt: now - (200 - index) * 1000, sourceApp: 'com.apple.Notes' }))
  // The endpoint fixture uses the same generated-API page shape as the application.
  await page.route('**/api/clipboard-entries?*', route => {
    const url = new URL(route.request().url())
    const start = (Number(url.searchParams.get('page')) - 1) * 100
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: rows.slice(start, start + 100) }) })
  })
  await page.evaluate(() => { window.__launcher.resetResultPosition(); return window.__launcher.reloadHistory() })
  assert.equal(await page.evaluate(() => window.__launcher.allResults().length), 200)
  await page.getByRole('button', { name: 'Show 100 more', exact: true }).click()
  await page.evaluate(() => { const s = window.__launcher; s.selected.set(150); const list = document.querySelector('#result-list'); list.scrollTop = 145 * 52; list.dispatchEvent(new Event('scroll')) })
  const selectedKey = await page.evaluate(() => window.__launcher.active().key)
  rows.shift()
  rows.push({ id: 201, content: 'Incoming while browsing', capturedAt: now + 10000, sourceApp: 'com.apple.Notes' })
  await page.evaluate(() => window.__launcher.reloadHistory())
  assert.equal(await page.evaluate(() => window.__launcher.active().key), selectedKey)
  assert.equal(await page.evaluate(() => window.__launcher.visibleLimit()), 200)
  await search.fill('incoming')
  assert.equal(await page.evaluate(() => window.__launcher.selected()), 0)
  assert.equal(await page.evaluate(() => window.__launcher.resultScrollTop()), 0)
  await search.fill('')
  await page.evaluate(dark => { window.__launcher.colorMode.set(dark ? 'dark' : 'light'); window.__launcher.applyTheme() }, !!process.env.LAUNCHPAD_UI_DARK)
  for (const width of [720, 560, 420]) {
    await page.setViewportSize({ width, height: 450 })
    assert.equal(await page.locator('main').evaluate(node => node.scrollWidth <= node.clientWidth), true, 'History fits without horizontal overflow.')
    const preview = await page.getByRole('complementary', { name: 'Clipboard preview' }).boundingBox()
    assert.ok(preview.width > 100 && preview.height > 50, 'Preview remains readable at smaller sizes.')
    assert.equal(await page.getByRole('button', { name: 'Save current clipboard', exact: true }).isVisible(), true)
    assert.equal(await page.getByRole('button', { name: 'Enable history', exact: true }).isVisible(), true)
    if (process.env.LAUNCHPAD_CLIPBOARD_SCREENSHOT) await page.screenshot({ path: process.env.LAUNCHPAD_CLIPBOARD_SCREENSHOT.replace('.png', `-${width}.png`), animations: 'disabled' })
  }
  assert.deepEqual(errors, [])
  console.log('Clipboard UI acceptance passed: chronological search, timestamps, preview, stable live selection, deletion, duplicate saves, retry, 200-entry paging, keyboard navigation, and responsive layout.')
}
finally { await browser.close() }
