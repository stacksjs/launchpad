import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import { mkdirSync } from 'node:fs'
const root = resolve('dist/site')
const server = Bun.serve({ port: 0, async fetch(request) {
  const path = decodeURIComponent(new URL(request.url).pathname)
  const file = resolve(root, path === '/' ? 'index.html' : `.${path}`)
  if (!file.startsWith(root + '/')) return new Response('missing', { status: 404 })
  const content = Bun.file(file)
  return await content.exists() ? new Response(content) : new Response('missing', { status: 404 })
} })
const { chromium } = await import(process.env.LAUNCHPAD_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, ...(process.env.LAUNCHPAD_BROWSER_EXECUTABLE ? { executablePath: process.env.LAUNCHPAD_BROWSER_EXECUTABLE } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1120, height: 800 } })
  const errors = []
  const submitted = []
  let outcome = 'offline'
  let accept = () => {}
  const hold = new Promise(resolve => { accept = resolve })
  page.on('pageerror', error => errors.push(String(error)))
  await page.route('**/api/subscribe', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    submitted.push(route.request().postDataJSON())
    if (outcome === 'offline') return route.fulfill({ status: 503, headers, contentType: 'text/html', body: 'offline' })
    await hold
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
  await page.goto(`http://localhost:${server.port}/#updates`)
  const form = page.getByRole('form', { name: 'Subscribe for Launchpad updates' })
  await form.getByLabel('Email address').fill('person@example.com')
  await form.getByRole('button', { name: 'Subscribe for updates', exact: true }).click()
  await form.getByRole('alert').waitFor()
  assert.equal(submitted.length, 1)
  assert.equal(await form.getByLabel('Email address').inputValue(), 'person@example.com')
  outcome = 'success'
  await form.getByRole('button', { name: 'Subscribe for updates', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('#subscriber-email')?.disabled)
  assert.equal(await form.getByRole('button', { name: 'Subscribing…', exact: true }).isDisabled(), true)
  assert.equal(submitted.length, 2)
  accept()
  await page.getByRole('status').getByText('You’re subscribed to Launchpad updates. Thanks for being here.', { exact: true }).waitFor()
  assert.deepEqual(submitted, [{ email: 'person@example.com' }, { email: 'person@example.com' }])
  assert.equal(await form.count(), 0)
  await page.reload()
  await form.getByLabel('Email address').fill('invalid')
  await form.getByRole('button', { name: 'Subscribe for updates', exact: true }).click()
  assert.equal(submitted.length, 2, 'Native email validation blocks malformed addresses before submission.')
  mkdirSync(resolve('dist/ui-evidence'), { recursive: true })
  for (const width of [1120, 560, 375]) {
    await page.setViewportSize({ width, height: 800 })
    await form.scrollIntoViewIfNeeded()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: join(root, '..', 'ui-evidence', `subscription-${width}.png`) })
  }
  assert.deepEqual(errors, [])
  console.log('Marketing subscription acceptance passed: native Stacks endpoint, validation, outage retry, pending state, success, duplicate prevention and responsive layout.')
}
finally { await browser.close(); server.stop(true) }
