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
const commands = [
  { key: 'command:web', title: 'Web search', kind: 'quicklink', alias: 'web', subtitle: 'Search the web', content: 'https://example.com/?q={query}' },
  { key: 'command:source', title: 'Source template', kind: 'snippet', subtitle: 'Snippet', content: 'const example = true' },
  ...Array.from({ length: 200 }, (_, index) => ({ key: `clipboard:${index}`, title: `Clipboard note ${index} JSON example`, kind: 'clipboard', subtitle: 'Clipboard', content: `Example ${index}` })),
]
const terms = {
  all: ['mail', 'maps', 'music', 'safari', 'system settings', 'web café & tea', '12 + 3 * 4', 'zzzz-no-result'],
  application: ['mail', 'maps', 'music', 'safari', 'system settings', 'zzzz-no-result'],
  quicklink: ['web café & tea', 'web source code', 'zzzz-no-result'],
  snippet: ['source', 'template', 'zzzz-no-result'],
  clipboard: ['clipboard note', 'json example', 'zzzz-no-result'],
  pantry: ['json', 'source code', 'c++', 'node.js', 'git', 'zzzz-no-result'],
  github: ['mail', 'repository', 'zzzz-no-result'],
}
try {
  for (const path of process.argv.slice(2)) {
    const source = readFileSync(path, 'utf8')
    assert.ok(source.includes('return { get "actionLabel"()') && source.includes('onMount(async () => {'), 'Build the native launcher before running the browser fixture.')
    // Expose only this isolated fixture's state and skip native startup. Never contact the user's backend.
    const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
    for (const category of (process.env.LAUNCHPAD_TYPING_CATEGORIES || Object.keys(terms).join(',')).split(',')) {
      const page = await browser.newPage({ viewport: { width: 720, height: 450 } })
      const errors = []
      const githubRequests = []
      const cancelled = []
      let finishObsolete
      const obsoleteFinished = new Promise(resolve => { finishObsolete = resolve })
      page.on('pageerror', error => errors.push(String(error)))
      page.on('requestfailed', request => cancelled.push(request.url()))
      await page.route('**/*', async (route) => {
        const url = new URL(route.request().url())
        if (url.origin === 'http://launchpad.test' && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
        if (url.origin === 'http://launchpad.test' && url.pathname === '/api/applications') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: apps }) })
        if (url.origin === 'https://api.github.com' && url.pathname === '/search/repositories') {
          const query = url.searchParams.get('q')
          githubRequests.push(query)
          const obsolete = query === 'obsolete-query'
          if (obsolete) await new Promise(resolve => setTimeout(resolve, 1200))
          try { await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [{ id: 1, full_name: `fixture/${query}`, html_url: 'https://github.com/fixture/result', description: 'Isolated fixture', stargazers_count: 1 }] }) }) }
          catch (error) { if (!obsolete) throw error }
          finally { if (obsolete) finishObsolete() }
          return
        }
        return route.abort()
      })
      await page.goto('http://launchpad.test/')
      await page.waitForFunction(() => window.__launcher)
      await page.evaluate(({ apps, catalog, commands, category }) => {
        const scope = window.__launcher
        window.batch(() => {
          scope.items.set([...apps, ...commands])
          scope.catalog.set(catalog)
          scope.category.set(category)
          scope.loading.set(false)
          scope.paletteVisible.set(true)
          scope.githubView.set('repositories')
          scope.githubScope.set('')
          scope.records.set({ [apps[0].key]: { launches: 400, lastUsed: 100 }, [apps[1].key]: { launches: 100, lastUsed: 500 } })
        })
      }, { apps, catalog, commands, category })
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
          const rows = [...document.querySelectorAll('[role="option"]')].filter(row => row.getAttribute('aria-hidden') !== 'true')
          return { handlerMs, rows: rows.length, createdRows: rows.filter(row => !before.has(row)).length }
        }))
      }
      const virtual = await page.evaluate(() => Boolean(window.__launcher.renderedResults))
      if (virtual) {
        const checkRows = async () => {
          const state = await page.evaluate(() => {
            const scope = window.__launcher
            const bounds = scope.viewport()
            return { actual: [...document.querySelectorAll('[role="option"]')].filter(row => row.getAttribute('aria-hidden') !== 'true').map(node => node.querySelector('.result-title').textContent), expected: scope.results().slice(bounds.start, bounds.end).map(item => item.title), height: document.getElementById('result-list').clientHeight }
          })
          assert.deepEqual(state.actual, state.expected)
          assert.ok(state.actual.length <= Math.ceil(state.height / 52) + 4, 'Only viewport rows should be mounted.')
        }
        await checkRows()
        const sequence = []
        for (const term of terms[category]) {
          const letters = Array.from(term)
          for (let end = 1; end <= letters.length; end++) sequence.push(letters.slice(0, end).join(''))
          for (let end = letters.length - 1; end >= 0; end--) sequence.push(letters.slice(0, end).join(''))
        }
        // Two no-delay passes exercise cold queries, warm caches, evictions and backspacing through no matches.
        const rapid = await page.evaluate(async (sequence) => {
          const scope = window.__launcher
          const input = document.querySelector('input[type="search"]')
          const original = new Set(document.querySelectorAll('#result-list [role="option"]'))
          const samples = []
          for (const query of [...sequence, ...sequence]) {
            const start = performance.now()
            input.value = query
            input.dispatchEvent(new Event('input', { bubbles: true }))
            await Promise.resolve()
            await Promise.resolve()
            const handlerMs = performance.now() - start
            const bounds = scope.viewport()
            const rows = [...document.querySelectorAll('#result-list [role="option"]')]
            const visible = rows.filter(row => row.getAttribute('aria-hidden') !== 'true')
            const actual = visible.map(row => row.querySelector('.result-title').textContent)
            const expected = scope.results().slice(bounds.start, bounds.end).map(item => item.title)
            if (scope.query() !== query || JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Stale results while typing ' + query)
            if (rows.some(row => !original.has(row))) throw new Error('Result rows were recreated while typing ' + query)
            if (rows.length > 13 || visible.length > Math.ceil(document.getElementById('result-list').clientHeight / 52) + 4) throw new Error('Result DOM grew while typing ' + query)
            if (!scope.results().length && input.hasAttribute('aria-activedescendant')) throw new Error('Empty search points to a parked row')
            samples.push({ handlerMs, query })
          }
          return samples
        }, sequence)
        const rapidTimings = rapid.map(sample => sample.handlerMs).sort((a, b) => a - b)
        process.stdout.write(JSON.stringify({ path, category, rapidInputs: rapid.length, rapidMedianMs: rapidTimings[Math.floor(rapid.length / 2)], rapidP95Ms: rapidTimings[Math.floor(rapid.length * 0.95)], rapidMaxMs: rapidTimings.at(-1), slowestQuery: rapid.reduce((a, b) => a.handlerMs > b.handlerMs ? a : b).query }) + '\n')
        await input.fill('m')
        if (category === 'github') {
          const before = githubRequests.length
          await page.evaluate(() => {
            const input = document.querySelector('input[type="search"]')
            for (const value of ['r', 're', 'rep', 'repo', 'rep', 're', 'repository-final']) {
              input.value = value
              input.dispatchEvent(new Event('input', { bubbles: true }))
            }
          })
          await page.waitForFunction(() => window.__launcher.githubItems()[0]?.title === 'fixture/repository-final')
          assert.deepEqual(githubRequests.slice(before), ['repository-final'], 'Rapid GitHub edits should request only the debounced final query.')
          const requested = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'obsolete-query')
          await input.fill('obsolete-query')
          await requested
          await input.fill('newest-query')
          await page.waitForFunction(() => window.__launcher.githubItems()[0]?.title === 'fixture/newest-query')
          await obsoleteFinished
          assert.ok(cancelled.some(url => new URL(url).searchParams.get('q') === 'obsolete-query'))
          assert.equal(await page.evaluate(() => window.__launcher.githubItems()[0]?.title), 'fixture/newest-query', 'An obsolete HTTP response must not replace newer results.')
          const pending = page.waitForRequest(request => new URL(request.url()).searchParams.get('q') === 'obsolete-query')
          await input.fill('obsolete-query')
          await pending
          const aborted = page.waitForEvent('requestfailed', request => new URL(request.url()).searchParams.get('q') === 'obsolete-query')
          await page.evaluate(() => window.__launcher.category.set('all'))
          await aborted
          assert.equal(await page.evaluate(() => window.__launcher.githubLoading()), false)
          assert.deepEqual(errors, [])
          process.stdout.write(JSON.stringify({ path, category, debouncedFinalOnly: true, obsoleteRequestCancelled: true, categoryChangeCancelled: true }) + '\n')
          await page.close()
          continue
        }
        if (category === 'all' || category === 'application') {
          assert.equal(await page.evaluate(() => window.__launcher.results()[0]?.key), apps[0].key, 'Mail must lead equal prefix matches by launch frequency.')
          await page.evaluate((key) => window.__launcher.records.set({ ...window.__launcher.records(), [key]: { launches: 600, lastUsed: 10 } }), apps[1].key)
          assert.equal(await page.evaluate(() => window.__launcher.results()[0]?.key), apps[1].key, 'Changed launch history must invalidate a cached M search immediately.')
          await page.evaluate((key) => window.__launcher.records.set({ ...window.__launcher.records(), [key]: { launches: 100, lastUsed: 500 } }), apps[1].key)
          assert.equal(await page.evaluate(() => window.__launcher.results()[0]?.key), apps[0].key)
        }
        if (category !== 'all' && category !== 'application' && category !== 'pantry') {
          await page.evaluate(() => window.__launcher.items.set([]))
          assert.ok(await page.evaluate(() => [...document.querySelectorAll('#result-list .result-title')].every(node => !node.textContent)), 'Removing source data must also clear parked row contents.')
          assert.deepEqual(errors, [])
          await page.close()
          continue
        }
        await page.evaluate(() => {
          const input = document.querySelector('input[type="search"]')
          input.focus()
          for (let step = 0; step < 15; step++) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
        })
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        await checkRows()
        const selection = await page.evaluate(() => {
          const scope = window.__launcher
          const node = document.getElementById('result-' + scope.selected())
          return { found: Boolean(node && !node.disabled && node.getAttribute('aria-hidden') !== 'true' && node.textContent.includes(scope.active()?.title)), selected: scope.selected(), bounds: scope.viewport(), top: document.getElementById('result-list').scrollTop, ids: [...document.querySelectorAll('#result-list [role="option"]')].map(node => node.id) }
        })
        assert.ok(selection.found, 'Keyboard selection must point to the current mounted result: ' + JSON.stringify(selection))
        await input.fill('ma')
        await input.press('Backspace')
        await checkRows()
        if (await page.evaluate(() => window.__launcher.allResults().length > window.__launcher.results().length)) {
          const before = await page.evaluate(() => window.__launcher.results().length)
          await page.getByRole('button', { name: /^Show .* more$/ }).click()
          assert.ok(await page.evaluate(before => window.__launcher.results().length > before, before))
          await page.evaluate(() => { const list = document.getElementById('result-list'); list.scrollTop = list.scrollHeight })
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
          await checkRows()
          assert.equal(await page.evaluate(() => window.__launcher.viewport().end), await page.evaluate(() => window.__launcher.results().length))
        }
        if (category === 'pantry') {
          const expected = await page.evaluate(() => window.__launcher.results()[window.__launcher.viewport().start].key)
          await page.locator('#result-list [role="option"]:not([aria-hidden="true"])').first().click()
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
