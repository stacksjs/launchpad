import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'

const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
assert.ok(source.includes('return { get "actionLabel"()') && source.includes('onMount(async () => {'))
const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
const errors = []
async function fixture() {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 }, colorScheme: process.env.LAUNCHPAD_UI_DARK ? 'dark' : 'light' })
  const data = { rows: [{ id: 1, content: 'Existing fixture copy', capturedAt: Date.now() - 1000 }], writes: [], clears: 0, failClear: false, failPreference: false, writeGate: null, preferenceGate: null, readGate: null }
  page.on('pageerror', error => errors.push(error.stack || String(error)))
  await page.addInitScript(factory => {
    const bridge = (0, eval)(`(${factory})`)(['window', 'app', 'serviceMenu', 'clipboard'])
    window.__bridge = bridge
    bridge.whenCalled('serviceMenu', 'register', { ok: true })
    bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 1, text: 'Initial pasteboard', blocked: false })
  }, installMockBridge.toString())
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    const method = route.request().method()
    const respond = value => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: value }) })
    const fail = error => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error }) })
    if (url.origin !== 'http://localhost') return route.abort()
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (url.pathname === '/api/clipboard-entries') {
      if (method === 'GET') {
        const body = JSON.stringify({ data: data.rows })
        const gate = data.readGate
        data.readGate = null
        if (gate) await gate.promise
        return route.fulfill({ contentType: 'application/json', body })
      }
      data.writes.push(route.request().postDataJSON())
      if (data.writeGate) await data.writeGate.promise
      const row = { id: Math.max(0, ...data.rows.map(row => row.id)) + 1, ...route.request().postDataJSON() }
      data.rows.push(row)
      return respond(row)
    }
    if (url.pathname === '/api/clipboard-history' && method === 'DELETE') {
      data.clears++
      if (data.failClear) return fail('History could not be cleared')
      data.rows = []
      return route.fulfill({ status: 204 })
    }
    if (['/api/applications', '/api/commands', '/api/launch-records', '/api/extensions'].includes(url.pathname)) return respond([])
    if (url.pathname.startsWith('/api/preferences')) {
      if (data.preferenceGate) await data.preferenceGate.promise
      if (data.failPreference) return fail('History setting could not be saved')
      return respond({ id: 1, ...route.request().postDataJSON() })
    }
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(async () => { const s = window.__launcher; s.loading.set(false); s.chooseCategory('clipboard'); await s.reloadHistory() })
  return { page, data }
}
async function confirmClear(page) {
  await page.getByRole('button', { name: 'Clear history', exact: true }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('button', { name: 'OK', exact: true }).click()
  await dialog.waitFor({ state: 'detached' })
}
try {
  {
    const { page, data } = await fixture()
    await page.evaluate(async () => { const s = window.__launcher; s.historyEnabled.set(true); await s.pollClipboard() })
    assert.equal(data.writes.length, 0, 'Starting recording establishes a baseline without copying the old pasteboard.')
    await page.evaluate(() => {
      window.__bridge.whenCalled('clipboard', 'historySnapshot', () => new Promise(resolve => { window.__snapshot = resolve }))
      window.__poll = window.__launcher.pollClipboard()
    })
    data.preferenceGate = deferred()
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    assert.equal(await page.evaluate(() => window.__launcher.historyEnabled()), false, 'Pause takes effect before preference storage finishes.')
    await page.evaluate(async () => { window.__snapshot({ changeCount: 2, text: 'Must never be saved', blocked: false }); await window.__poll })
    assert.equal(data.writes.length, 0, 'A read that finishes after pause must be discarded.')
    data.preferenceGate.resolve()
    await page.waitForFunction(() => !window.__launcher.historyPreferenceBusy())
    assert.equal(await page.evaluate(() => window.__launcher.historyStatus()), 'History is paused')
    await page.evaluate(() => window.__bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 3, text: 'Copied while paused', blocked: false }))
    await page.getByRole('button', { name: 'Enable history', exact: true }).click()
    await page.waitForFunction(() => window.__launcher.historyEnabled())
    assert.equal(data.writes.length, 0, 'Resuming never backfills text copied while paused.')
    await page.evaluate(async () => { window.__bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 4, text: 'New after resume', blocked: false }); await window.__launcher.pollClipboard() })
    assert.equal(data.writes.length, 1)
    data.failPreference = true
    await page.getByRole('button', { name: 'Pause', exact: true }).click()
    await page.getByText('History setting could not be saved', { exact: true }).waitFor()
    assert.equal(await page.evaluate(() => window.__launcher.historyEnabled()), false, 'Failure to persist pause must never turn recording back on.')
    data.failPreference = false
    await page.getByRole('button', { name: 'Save paused setting', exact: true }).click()
    await page.waitForFunction(() => !window.__launcher.historyPreferenceBusy())
    assert.equal(await page.evaluate(() => window.__launcher.historyPreferenceUnsaved()), false)
    assert.equal(await page.getByRole('alert').count(), 0, 'Successful retry removes the old error.')
    await page.close()
  }
  {
    const { page, data } = await fixture()
    data.writeGate = deferred()
    const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/clipboard-entries' && request.method() === 'POST')
    await page.evaluate(() => {
      window.__activeWrite = window.__launcher.saveHistoryText('Already accepted write')
      window.__queuedWrite = window.__launcher.saveHistoryText('Queued before clear')
      window.__bridge.whenCalled('clipboard', 'readText', () => new Promise(resolve => { window.__manual = resolve }))
      window.__manualSave = window.__launcher.saveClipboard()
    })
    await request
    await confirmClear(page)
    await page.waitForFunction(() => window.__launcher.historyClearing())
    assert.equal(data.clears, 0, 'Clear waits for the accepted write to finish.')
    assert.equal(await page.getByRole('button', { name: 'Save current clipboard', exact: true }).isDisabled(), true)
    data.writeGate.resolve()
    await page.waitForFunction(() => !window.__launcher.historyClearing())
    await page.evaluate(async () => { window.__manual('Delayed manual read'); await Promise.all([window.__activeWrite, window.__queuedWrite, window.__manualSave]) })
    assert.equal(data.writes.length, 1, 'Queued writes and delayed manual reads are invalidated by Clear.')
    assert.equal(data.rows.length, 0)
    await page.getByText('Keep useful text close.', { exact: true }).waitFor()
    await page.evaluate(() => window.__launcher.saveHistoryText('Explicit save after clear'))
    assert.equal(data.rows.length, 1, 'Explicit saves still work after clearing.')
    await page.close()
  }
  {
    const { page, data } = await fixture()
    await page.evaluate(async () => { const s = window.__launcher; s.historyEnabled.set(true); await s.pollClipboard() })
    await page.evaluate(() => {
      window.__bridge.whenCalled('clipboard', 'historySnapshot', cursor => cursor === -1 ? { changeCount: 10, text: 'Old pasteboard', blocked: false } : new Promise(resolve => { window.__snapshot = resolve }))
      window.__oldPoll = window.__launcher.pollClipboard()
    })
    await confirmClear(page)
    await page.waitForFunction(() => !window.__launcher.historyClearing())
    await page.evaluate(async () => { window.__snapshot({ changeCount: 9, text: 'Stale automatic capture', blocked: false }); await window.__oldPoll })
    assert.equal(data.rows.length, 0, 'An automatic capture from before Clear cannot repopulate history.')
    await page.evaluate(async () => {
      window.__bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 10, text: null, blocked: false }); await window.__launcher.pollClipboard()
      window.__bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 11, text: 'Protected fixture', blocked: true }); await window.__launcher.pollClipboard()
      window.__bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 12, text: 'x'.repeat(20001), blocked: false }); await window.__launcher.pollClipboard()
    })
    assert.equal(data.writes.length, 0, 'Unchanged, protected and oversized pasteboard content remains excluded.')
    await page.evaluate(async () => { window.__bridge.whenCalled('clipboard', 'historySnapshot', { changeCount: 13, text: 'A genuinely new copy', blocked: false }); await window.__launcher.pollClipboard() })
    assert.equal(data.rows.length, 1)
    data.failClear = true
    await confirmClear(page)
    await page.getByText('History could not be cleared', { exact: true }).waitFor()
    assert.equal(data.rows.length, 1, 'A failed Clear must not pretend entries were removed.')
    assert.equal(await page.evaluate(() => window.__launcher.historyClearing()), false)
    data.failClear = false
    await confirmClear(page)
    await page.waitForFunction(() => !window.__launcher.historyClearing())
    assert.equal(data.rows.length, 0, 'Clear can be retried after a storage failure.')
    assert.equal(await page.getByRole('alert').count(), 0)
    await page.close()
  }
  {
    const { page, data } = await fixture()
    for (const method of ['reload', 'reloadHistory']) {
      if (!data.rows.length) await page.evaluate(() => window.__launcher.saveHistoryText('New fixture copy'))
      data.readGate = deferred()
      const gate = data.readGate
      const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/clipboard-entries' && request.method() === 'GET')
      await page.evaluate(method => { window.__staleRead = window.__launcher[method]() }, method)
      await request
      await confirmClear(page)
      await page.waitForFunction(() => !window.__launcher.historyClearing())
      gate.resolve()
      await page.evaluate(() => window.__staleRead)
      assert.equal(data.rows.length, 0)
      assert.equal(await page.evaluate(() => window.__launcher.items().filter(item => item.kind === 'clipboard').length), 0, `A stale ${method} response cannot put cleared rows back on screen.`)
    }
    await page.evaluate(() => window.__launcher.saveHistoryText('First fixture copy'))
    data.readGate = deferred()
    const gate = data.readGate
    const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/clipboard-entries' && request.method() === 'GET')
    await page.evaluate(() => { window.__staleRead = window.__launcher.reloadHistory() })
    await request
    data.rows.push({ id: 2, content: 'Newer fixture copy', capturedAt: Date.now() + 1000 })
    await page.evaluate(() => window.__launcher.reloadHistory())
    gate.resolve()
    await page.evaluate(() => window.__staleRead)
    assert.equal(await page.evaluate(() => window.__launcher.results()[0].content), 'Newer fixture copy', 'An older refresh cannot replace a newer result snapshot.')
    await page.close()
  }
  assert.deepEqual(errors, [])
  console.log('Clipboard reliability passed: pause boundaries, no resume backfill, preference retry, in-flight/queued/manual/automatic clear races, protected content, failed-clear retry, and stale refresh responses.')
}
finally { await browser.close() }
