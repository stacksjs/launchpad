import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installMockBridge } from '@stacksjs/desktop/test-utils'

const source = readFileSync(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html', 'utf8')
assert.ok(source.includes('return { get "actionLabel"()') && source.includes('onMount(async () => {'))
const html = source.replace('return { get "actionLabel"()', 'return window.__launcher = { get "actionLabel"()').replace('onMount(async () => {', 'onMount(async () => { return;')
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
const apps = ['ChatGPT', 'Codex', 'Mail'].map(title => ({ key: `/Applications/${title}.app`, title, kind: 'application', subtitle: 'Application', content: `/Applications/${title}.app`, searchAliases: title === 'ChatGPT' ? ['codex', 'openai', 'gpt'] : title === 'Mail' ? ['email'] : [] }))
const record = { id: 7, key: apps[0].key, favorite: 1, launches: 400, last_used: 123, aliases: '' }
const saved = new Map([[record.key, record]])
const writes = []
let denyWrite = true
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 450 } })
  const errors = []
  page.on('pageerror', error => errors.push(String(error)))
  await page.addInitScript(factory => { (0, eval)(`(${factory})`)(['shell', 'window']) }, installMockBridge.toString())
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://launchpad.test') return route.abort()
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    let data = []
    if (url.pathname === '/api/applications') data = apps
    else if (url.pathname.startsWith('/api/launch-records')) {
      if (route.request().method() !== 'GET') {
        if (denyWrite) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Fixture save unavailable"}' })
        const input = route.request().postDataJSON()
        writes.push(input)
        const previous = saved.get(input.key)
        data = { id: 7 + saved.size, favorite: 0, launches: 0, last_used: 0, ...previous, ...input }
        saved.set(input.key, data)
      }
      else data = [...saved.values()]
    }
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data }) })
  })
  await page.goto('http://launchpad.test/')
  await page.waitForFunction(() => window.__launcher)
  await page.evaluate(({ apps, record }) => {
    const s = window.__launcher
    window.batch(() => { s.items.set(apps); s.records.set({ [record.key]: record }); s.loading.set(false); s.paletteVisible.set(true) })
  }, { apps, record })
  const input = page.locator('input[type="search"]')
  const titles = () => page.locator('[role="option"]:not([aria-hidden="true"]) .result-title').allTextContents()
  await input.fill('codex')
  assert.deepEqual(await titles(), ['Codex', 'ChatGPT'])
  await input.fill('gpt')
  await input.press('Meta+e')
  const dialog = page.getByRole('dialog', { name: 'Application search aliases' })
  await dialog.waitFor()
  const aliases = dialog.getByLabel('Your aliases', { exact: false })
  await page.waitForFunction(() => document.activeElement?.id === 'application-aliases', { timeout: 3000 })
  assert.equal(await aliases.evaluate(node => document.activeElement === node), true)
  await aliases.fill('work ai, WORK AI\nCafé')
  if (process.env.LAUNCHPAD_ALIAS_SCREENSHOT) await page.screenshot({ path: process.env.LAUNCHPAD_ALIAS_SCREENSHOT })
  await dialog.getByRole('button', { name: 'Save aliases' }).click()
  await dialog.getByText('Fixture save unavailable', { exact: true }).waitFor()
  assert.equal(saved.get(record.key).aliases, '')
  denyWrite = false
  await dialog.getByRole('button', { name: 'Save aliases' }).click()
  await dialog.waitFor({ state: 'detached' })
  assert.equal(saved.get(record.key).aliases, 'work ai\nCafé')
  assert.equal(saved.get(record.key).launches, 400)
  assert.equal(saved.get(record.key).favorite, 1)
  for (const query of ['w', 'wo', 'work', 'work ai', 'work', 'wo', 'w', 'cafe']) {
    await input.fill(query)
    assert.deepEqual(await titles(), ['ChatGPT'])
  }
  await page.evaluate(() => window.__launcher.reload())
  await input.fill('work ai')
  assert.deepEqual(await titles(), ['ChatGPT'])
  await page.getByRole('button', { name: 'Edit application search aliases' }).click()
  await aliases.fill('x'.repeat(65))
  await dialog.getByRole('button', { name: 'Save aliases' }).click()
  await dialog.getByText('Use up to 20 aliases, with at most 64 characters each.', { exact: true }).waitFor()
  assert.equal(writes.length, 1)
  await aliases.fill('')
  await dialog.getByRole('button', { name: 'Save aliases' }).click()
  await dialog.waitFor({ state: 'detached' })
  await input.fill('work ai')
  assert.deepEqual(await titles(), [])
  await input.fill('codex')
  assert.deepEqual(await titles(), ['Codex', 'ChatGPT'])
  await input.fill('mail')
  await input.press('Meta+e')
  await aliases.fill('inbox')
  await dialog.getByRole('button', { name: 'Save aliases' }).click()
  await dialog.waitFor({ state: 'detached' })
  await input.fill('inbox')
  assert.deepEqual(await titles(), ['Mail'])
  assert.equal(saved.get(apps[2].key).aliases, 'inbox')
  assert.deepEqual(errors, [])
  process.stdout.write(JSON.stringify({ exactNameBeforeAlias: true, keyboardEditor: true, failedSaveRetry: true, immediateSearchAndReload: true, clearKeepsBuiltIns: true, rankingRetained: true, firstAliasCreatesRecord: true }) + '\n')
}
finally { await browser.close() }
