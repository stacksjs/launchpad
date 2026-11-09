import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'
import { launcherPage } from './launcher-page.mjs'

const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
const html = launcherPage(source)
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 }, colorScheme: process.env.LAUNCHPAD_UI_DARK ? 'dark' : 'light' })
  const errors = []
  const writes = []
  const commands = []
  const activity = []
  let failCommand = false
  const apps = [
    { key: '/Applications/Safari.app', title: 'Safari Technology Preview', content: '/Applications/Safari.app', subtitle: 'Application', kind: 'application', bundleId: 'com.apple.Safari' },
    { key: '/Applications/TextEdit.app', title: 'TextEdit', content: '/Applications/TextEdit.app', subtitle: 'Application', kind: 'application', bundleId: 'com.apple.TextEdit' },
  ]
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
    if (url.pathname === '/api/applications') return respond(apps)
    if (url.pathname === '/api/commands') {
      if (method === 'GET') return respond(commands)
      if (failCommand) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Snippet could not be saved' }) })
      const row = { id: commands.length + 1, ...route.request().postDataJSON() }
      commands.push(row)
      return respond(row)
    }
    if (url.pathname === '/api/ranking') return respond({ id: 90, ...route.request().postDataJSON(), launches: 1 })
    if (url.pathname === '/api/activity-events') { activity.push(route.request().postDataJSON()); return route.fulfill({ status: 204 }) }
    if (url.pathname === '/api/clipboard-history') { rows = []; return route.fulfill({ status: 204 }) }
    if (['/api/commands', '/api/extensions', '/api/launch-records'].includes(url.pathname)) return respond([])
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(apps => {
    const s = window.__launcher
    s.items.set(apps)
    s.icons.set({ '/Applications/Safari.app': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=' })
    s.loading.set(false); s.chooseCategory('clipboard')
    s.records.set({ 'clipboard:1': { favorite: true, launches: 999, lastUsed: Date.now() } })
  }, apps)
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
  const filter = page.getByRole('combobox', { name: 'Filter by source app' })
  await search.fill('')
  await filter.selectOption('com.apple.Safari')
  assert.deepEqual(await page.evaluate(() => window.__launcher.results().map(row => row.id)), [2])
  assert.match(await page.locator('#result-0 .result-subtitle').textContent(), /Safari Technology Preview/)
  assert.match(await page.locator('#result-0 img').getAttribute('src'), /^data:image/)
  await search.fill('studio')
  await page.getByText('No matching clipboard text.', { exact: true }).waitFor()
  await search.fill('')
  await filter.selectOption('com.apple.TextEdit')
  assert.deepEqual(await page.evaluate(() => window.__launcher.results().map(row => row.id)), [3])
  await filter.selectOption('com.apple.Safari')
  rows.push({ id: 4, content: 'A newer copy from a different app', capturedAt: Date.now(), sourceApp: 'com.apple.TextEdit' })
  await page.evaluate(() => window.__launcher.reloadHistory())
  assert.equal(await page.evaluate(() => window.__launcher.active().id), 2, 'An incoming copy from another app cannot change the filtered preview.')
  rows.pop()
  await page.evaluate(() => window.__launcher.reloadHistory())
  await page.evaluate(() => window.__launcher.historySource.set('com.example.Removed'))
  await page.getByText('No copies from this app.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Show all apps', exact: true }).click()
  assert.equal(await filter.inputValue(), 'all')
  await search.fill('resume checklist')

  const snippetText = rows[1].content
  const hides = () => page.evaluate(() => window.__bridge.calls.filter(call => call.method === 'hide').length)
  const beforeCopy = await hides()
  await page.evaluate(() => { window.__launcher.paletteVisible.set(true); window.__launcher.usageEnabled.set(true); window.__launcher.preferencesReady.set(true) })
  await page.getByRole('button', { name: 'Copy and keep browsing', exact: true }).click()
  await page.getByText('Copied. Keep browsing.', { exact: true }).waitFor()
  await page.evaluate(() => window.__launcher.flushUsage())
  assert.equal(await hides(), beforeCopy, 'Copy here must never dismiss the native window.')
  assert.equal(await page.evaluate(() => window.__launcher.paletteVisible()), true)
  assert.equal(await page.getByLabel('Selected clipboard text').textContent(), snippetText)
  assert.equal(activity.filter(event => event.action === 'command_executed' && event.kind === 'clipboard').length, 1)
  assert.equal(activity.some(event => event.action === 'palette_dismissed'), false)
  assert.equal(JSON.stringify(activity).includes('checklist'), false, 'Usage records must never contain clipboard text.')
  await search.press('Meta+Enter')
  await page.waitForFunction(() => !window.__launcher.saving())
  assert.equal(await hides(), beforeCopy, 'Command Return uses the same keep-open action.')
  await page.evaluate(() => window.__bridge.whenCalled('clipboard', 'writeText', () => { throw new Error('Clipboard write refused') }))
  await page.getByRole('button', { name: 'Copy and keep browsing', exact: true }).click()
  await page.getByRole('alert').getByText('Clipboard write refused', { exact: true }).waitFor()
  assert.equal(await page.getByText('Copied. Keep browsing.', { exact: true }).count(), 0, 'A failed retry cannot retain an old success message.')
  await page.evaluate(() => window.__launcher.flushUsage())
  assert.equal(activity.filter(event => event.action === 'command_executed' && event.kind === 'clipboard').length, 2, 'Failed copies earn no usage event.')
  assert.equal(await hides(), beforeCopy)
  await page.evaluate(() => { window.__bridge.whenCalled('clipboard', 'writeText', undefined); window.__launcher.clearError(); window.__launcher.preferencesReady.set(false) })

  await page.getByRole('button', { name: 'Save as snippet', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Save clipboard as snippet', exact: true })
  assert.equal(await editor.getByLabel('Text to copy', { exact: true }).inputValue(), snippetText)
  assert.equal(await editor.getByLabel('Type', { exact: true }).isDisabled(), true)
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  assert.equal(commands.length, 0, 'Cancelling conversion writes nothing.')
  assert.equal(rows.length, 3, 'Conversion never removes the original clipboard entry.')
  await page.getByRole('button', { name: 'Save as snippet', exact: true }).click()
  await editor.getByLabel('Name', { exact: true }).fill('Reusable checklist')
  failCommand = true
  await editor.getByRole('button', { name: 'Save snippet', exact: true }).click()
  await editor.getByRole('alert').getByText('Snippet could not be saved', { exact: true }).waitFor()
  assert.equal(await editor.getByLabel('Text to copy', { exact: true }).inputValue(), snippetText)
  assert.equal(commands.length, 0)
  failCommand = false
  await editor.getByRole('button', { name: 'Save snippet', exact: true }).click()
  await editor.waitFor({ state: 'detached' })
  await page.getByText('Snippet saved. Find it in Snippets.', { exact: true }).waitFor()
  assert.equal(await page.getByRole('alert').count(), 0, 'Successful snippet retry clears its prior error.')
  assert.equal(commands.length, 1)
  assert.equal(commands[0].kind, 'snippet')
  assert.equal(commands[0].content, snippetText, 'Saved snippets preserve all original text and line breaks.')
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
  assert.equal(await page.getByRole('button', { name: /^Show \d+ more$/ }).count(), 0)
  await page.evaluate(() => { const s = window.__launcher; s.selected.set(150); const list = document.querySelector('#result-list'); list.scrollTop = 145 * 52; list.dispatchEvent(new Event('scroll')) })
  const selectedKey = await page.evaluate(() => window.__launcher.active().key)
  rows.shift()
  rows.push({ id: 201, content: 'Incoming while browsing', capturedAt: now + 10000, sourceApp: 'com.apple.Notes' })
  await page.evaluate(() => window.__launcher.reloadHistory())
  assert.equal(await page.evaluate(() => window.__launcher.active().key), selectedKey)
  assert.equal(await page.evaluate(() => window.__launcher.results().length), 200)
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
  await page.unroute('**/api/clipboard-entries?*')
  await page.getByRole('button', { name: 'Clear history', exact: true }).click()
  const confirmation = page.getByRole('alertdialog')
  await confirmation.getByRole('button', { name: 'OK', exact: true }).click()
  await confirmation.waitFor({ state: 'detached' })
  await page.waitForFunction(() => !window.__launcher.historyClearing())
  await page.evaluate(async () => { await window.__launcher.reload(); window.__launcher.chooseCategory('snippet') })
  assert.equal(await page.locator('#result-0 .result-title').textContent(), 'Reusable checklist', 'Saved snippets survive clearing clipboard history and reloading.')
  assert.equal(commands[0].content, snippetText)
  assert.deepEqual(errors, [])
  console.log('Clipboard UI acceptance passed: chronological search, timestamps, preview, stable live selection, deletion, duplicate saves, retry, source names/icons/filters, snippet conversion, copy here, privacy-safe usage, 200-entry paging, keyboard navigation, and responsive layout.')
}
finally { await browser.close() }
