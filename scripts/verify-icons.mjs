import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'

const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
assert.ok(source.includes('return { get "actionLabel"()') && source.includes('onMount(async () => {'))
const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
const apps = Array.from({ length: 120 }, (_, index) => ({ key: `/Applications/Fixture${index}.app`, content: `/Applications/Fixture${index}.app`, title: `Fixture app ${String(index).padStart(3, '0')}`, subtitle: 'Application', kind: 'application', bundleId: `test.fixture.${index}` }))
apps.push(...['Broken', 'Missing'].map(name => ({ key: `/Applications/${name}.app`, content: `/Applications/${name}.app`, title: `ZZZ ${name} icon`, subtitle: 'Application', kind: 'application' })))
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 }, colorScheme: process.env.LAUNCHPAD_UI_DARK ? 'dark' : 'light' })
  const errors = []
  page.on('pageerror', error => errors.push(error.stack || String(error)))
  await page.addInitScript(factory => {
    const bridge = (0, eval)(`(${factory})`)(['window', 'app', 'serviceMenu'])
    window.__bridge = bridge
    window.__prepared = []
    window.__activeIcons = 0
    window.__peakIcons = 0
    const decode = Image.prototype.decode
    Image.prototype.decode = async function () { await decode.call(this); window.__prepared.push(this.src) }
    bridge.whenCalled('serviceMenu', 'register', { ok: true })
    bridge.whenCalled('app', 'icon', async path => {
      window.__peakIcons = Math.max(window.__peakIcons, ++window.__activeIcons)
      try {
        if (path === '/Applications/Fixture0.app') await new Promise(resolve => { window.__releaseFirst = resolve })
        else await new Promise(resolve => setTimeout(resolve, 20))
        if (path === '/Applications/Broken.app') throw new Error('Fixture icon is unreadable')
        if (path === '/Applications/Missing.app') return null
        return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><rect width="34" height="34" rx="7" fill="#356ac3"/><title>${path}</title></svg>`)
      }
      finally { window.__activeIcons-- }
    })
  }, installMockBridge.toString())
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://localhost') return route.abort()
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (url.pathname === '/api/applications') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: apps }) })
    return route.abort()
  })
  await page.goto('http://localhost/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(apps => { const s = window.__launcher; s.items.set(apps); s.loading.set(false); s.category.set('application') }, apps)
  await page.waitForFunction(() => window.__launcher.icons()['/Applications/Fixture25.app'])
  assert.equal(await page.evaluate(() => window.__launcher.paletteVisible()), false, 'Local icons warm before the native palette opens.')
  assert.equal(await page.evaluate(() => window.__launcher.icons()['/Applications/Fixture0.app']), undefined)
  assert.equal(await page.evaluate(() => Boolean(window.__launcher.icons()['/Applications/Fixture1.app'])), true, 'One slow icon cannot hold back ready neighboring icons.')
  assert.equal(await page.locator('#result-25').count(), 0, 'Several screens ahead must be loaded before those rows enter the DOM.')
  assert.equal(await page.evaluate(() => window.__prepared.includes(window.__launcher.icons()['/Applications/Fixture25.app'])), true, 'Offscreen icons are decoded before publication.')
  await page.evaluate(() => window.__launcher.paletteVisible.set(true))
  async function scrollAndCheck(index) {
    const visible = await page.evaluate(async index => {
      const list = document.querySelector('#result-list')
      list.scrollTop = index * 52
      list.dispatchEvent(new Event('scroll'))
      await new Promise(requestAnimationFrame)
      const bounds = list.getBoundingClientRect()
      return [...list.querySelectorAll('[role="option"]')].filter(row => row.getAttribute('aria-hidden') !== 'true' && row.getBoundingClientRect().bottom > bounds.top && row.getBoundingClientRect().top < bounds.bottom).map(row => {
        const image = row.querySelector('img')
        return { title: row.querySelector('.result-title').textContent, ready: Boolean(image?.complete && image.naturalWidth), placeholder: Boolean(row.querySelector('.i-f7-square-grid-2x2')) }
      })
    }, index)
    assert.ok(visible.length > 0)
    assert.ok(visible.every(row => row.ready && !row.placeholder), `Every row must enter with a ready icon: ${JSON.stringify(visible)}`)
  }
  await scrollAndCheck(18)
  await page.evaluate(() => window.__releaseFirst())
  await page.evaluate(() => window.__launcher.iconPrefetcher.idle())
  assert.equal(await page.evaluate(() => window.__peakIcons), 4)
  assert.equal(await page.evaluate(() => window.__bridge.calls.filter(call => call.ns === 'app' && call.method === 'icon').length), 122, 'Every native source is fetched once, including failed icons.')
  for (const index of [60, 4, 80, 12, 90, 0]) await scrollAndCheck(index)
  await page.getByRole('button', { name: 'Show 22 more', exact: true }).click()
  await scrollAndCheck(108)
  const search = page.getByRole('combobox', { name: 'Search applications and commands' })
  await search.fill('Fixture app 118')
  await scrollAndCheck(0)
  await search.fill('ZZZ')
  await page.waitForFunction(() => window.__launcher.results().length === 2)
  assert.equal(await page.locator('#result-0 .i-f7-square-grid-2x2').count(), 1)
  await search.fill('')
  await page.evaluate(() => window.__launcher.iconPrefetcher.idle())
  assert.equal(await page.evaluate(() => window.__bridge.calls.filter(call => call.ns === 'app' && call.method === 'icon').length), 122, 'Scrolling, searching and reopening cannot reread missing icons.')
  assert.deepEqual(errors, [])
  console.log('Icon UI acceptance passed: hidden warmup, offscreen decoding, progressive updates, scrolling in both directions, fast jumps, next-page readiness, bounded native reads, and stable missing-icon fallbacks.')
}
finally { await browser.close() }
