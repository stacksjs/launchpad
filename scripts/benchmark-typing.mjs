import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bundledPackageCatalog } from 'ts-pantry/catalog'

// Playwright is an optional development tool; no browser code ships in the app.
assert.ok(process.argv.length > 2, 'Usage: node scripts/benchmark-typing.mjs <built index.html> [baseline index.html]')
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
const icon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"/>'
const names = ['Mail', 'Maps', 'Music', 'Messages', 'Microsoft Word', 'Calendar', 'Safari', 'System Settings']
const apps = Array.from({ length: 112 }, (_, index) => ({ key: `/Applications/App${index}.app`, title: `${names[index % names.length]} ${index}`, kind: 'application', subtitle: 'Application', content: `/Applications/App${index}.app`, searchAliases: [`com.example.app${index}`], icon }))
const catalog = bundledPackageCatalog().map(entry => ({ ...entry, logo: { url: icon } }))
try {
  for (const path of process.argv.slice(2)) {
    const source = readFileSync(path, 'utf8')
    assert.ok(source.includes('return { get "actionLabel"()') && source.includes('onMount(async () => {'), 'Build the native launcher before running the browser fixture.')
    // Expose only this isolated fixture's state and skip native startup. Never contact the user's backend.
    const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
    for (const category of (process.env.LAUNCHPAD_TYPING_CATEGORIES || 'all,pantry').split(',')) {
      const page = await browser.newPage({ viewport: { width: 720, height: 450 } })
      const errors = []
      page.on('pageerror', error => errors.push(String(error)))
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (url.origin === 'http://launchpad.test' && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
        if (url.origin === 'http://launchpad.test' && url.pathname === '/api/applications') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: apps }) })
        return route.abort()
      })
      await page.goto('http://launchpad.test/')
      await page.waitForFunction(() => window.__launcher)
      await page.evaluate(({ apps, catalog, category }) => {
        const scope = window.__launcher
        window.batch(() => {
          scope.items.set(apps)
          scope.catalog.set(catalog)
          scope.category.set(category)
          scope.loading.set(false)
          scope.paletteVisible.set(true)
        })
      }, { apps, catalog, category })
      const input = page.locator('input[type="search"]')
      const samples = []
      for (let run = 0; run < 12; run++) {
        await input.fill('')
        await page.evaluate(() => new Promise(requestAnimationFrame))
        samples.push(await page.evaluate(async () => {
          const input = document.querySelector('input[type="search"]')
          const before = new Set(document.querySelectorAll('[role="option"]'))
          const start = performance.now()
          input.value = 'm'
          input.dispatchEvent(new Event('input', { bubbles: true }))
          await Promise.resolve()
          await Promise.resolve()
          const handlerMs = performance.now() - start
          await new Promise(requestAnimationFrame)
          const rows = [...document.querySelectorAll('[role="option"]')]
          return { handlerMs, rows: rows.length, createdRows: rows.filter(row => !before.has(row)).length }
        }))
      }
      const virtual = await page.evaluate(() => Boolean(window.__launcher.renderedResults))
      if (virtual) {
        const checkRows = async () => {
          const state = await page.evaluate(() => {
            const scope = window.__launcher
            const bounds = scope.viewport()
            return { actual: [...document.querySelectorAll('[role="option"] .result-title')].map(node => node.textContent), expected: scope.results().slice(bounds.start, bounds.end).map(item => item.title), height: document.getElementById('result-list').clientHeight }
          })
          assert.deepEqual(state.actual, state.expected)
          assert.ok(state.actual.length <= Math.ceil(state.height / 52) + 4, 'Only viewport rows should be mounted.')
        }
        await checkRows()
        for (let step = 0; step < 15; step++) await input.press('ArrowDown')
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        await checkRows()
        assert.ok(await page.evaluate(() => {
          const scope = window.__launcher
          return document.getElementById('result-' + scope.selected())?.textContent.includes(scope.active().title)
        }), 'Keyboard selection must point to the current mounted result.')
        await input.fill('ma')
        await input.press('Backspace')
        await checkRows()
        if (category === 'pantry') {
          const expected = await page.evaluate(() => window.__launcher.results()[window.__launcher.viewport().start].key)
          await page.locator('#result-list [role="option"]').first().click()
          assert.equal(await page.evaluate(() => window.__launcher.packageDetail()?.key), expected, 'Recycled rows must open their current package.')
        }
      }
      assert.deepEqual(errors, [])
      const timings = samples.map(sample => sample.handlerMs).sort((a, b) => a - b)
      process.stdout.write(JSON.stringify({ path, category, virtual, medianHandlerMs: timings[6], p95HandlerMs: timings[11], maxMountedRows: Math.max(...samples.map(sample => sample.rows)), createdRows: samples.reduce((sum, sample) => sum + sample.createdRows, 0) }) + '\n')
      await page.close()
    }
  }
}
finally { await browser.close() }
