import { strict as assert } from 'node:assert'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const executable = resolve(process.argv[2] || 'dist/Launchpad.app/Contents/MacOS/stx-backend')
assert.ok(existsSync(executable), 'Build the native app with ./buddy build first.')
const profile = mkdtempSync(join(tmpdir(), 'launchpad-clipboard-native-'))
let child: Bun.Subprocess<'pipe', 'pipe', 'pipe'> | undefined
async function start() {
  const backend = Bun.spawn([executable, '--serve', '--managed'], { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env: { ...process.env, STX_DATA_HOME: profile } })
  child = backend
  const first = await Promise.race([backend.stdout.getReader().read(), Bun.sleep(10000).then(() => { throw new Error('Packaged backend did not become ready.') })])
  const ready = new TextDecoder().decode(first.value ?? new Uint8Array()).trim()
  const origin = new URL(ready).origin
  assert.equal((await fetch(`${origin}/api/clipboard-entries`)).status, 403)
  const login = await fetch(ready, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
  assert.equal(login.status, 303)
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!
  return async (path: string, body?: unknown, method = body ? 'POST' : 'GET', expected?: number) => {
    const response = await fetch(`${origin}/api/${path}`, { signal: AbortSignal.timeout(5000), method, headers: { cookie, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    if (expected) assert.equal(response.status, expected, `${method} ${path}: ${await response.clone().text()}`)
    else assert.ok(response.ok, `API status ${response.status} for ${method} ${path}`)
    return response.status === 204 ? null : await response.json()
  }
}
async function stop() {
  if (!child || child.exitCode !== null) return
  child.stdin.end()
  assert.equal(await Promise.race([child.exited, Bun.sleep(5000).then(() => 'timeout')]), 0)
}
try {
  let request = await start()
  const text = '  Reusable native fixture\nSecond line 😀\n  '
  await request('preferences', { key: 'history', value: JSON.stringify({ enabled: false, days: 1 }) })
  await request('clipboard-entries', { content: 'Expired fixture', capturedAt: Date.now() - 2 * 86400000 })
  const legacy = (await request('clipboard-entries', { content: 'Legacy fixture', capturedAt: 0 })).data
  const copy = (await request('clipboard-entries', { content: text, capturedAt: Date.now(), sourceApp: 'com.apple.Notes' })).data
  const history = (await request('clipboard-entries')).data
  assert.equal(history.length, 2, 'The production route prunes expired entries.')
  assert.ok(history.some((row: { id: number }) => row.id === legacy.id))
  const snippet = (await request('commands', { title: 'Native fixture snippet', kind: 'snippet', content: text })).data
  await request('launch-records', { key: `clipboard:${copy.id}`, favorite: true })
  await request('launch-records', { key: `command:${snippet.id}`, favorite: true })
  await request('clipboard-history', undefined, 'DELETE')
  assert.equal((await request('clipboard-entries')).data.length, 0)
  assert.equal((await request('commands')).data[0].content, text)
  assert.deepEqual((await request('launch-records')).data.map((row: { key: string }) => row.key), [`command:${snippet.id}`])
  const fresh = (await request('clipboard-entries', { content: 'Fresh after clear', capturedAt: Date.now() })).data
  await stop()
  request = await start()
  assert.equal((await request('commands')).data[0].content, text, 'The saved snippet survives a real backend restart.')
  assert.equal((await request('clipboard-entries')).data[0].id, fresh.id)
  assert.equal(JSON.parse((await request('preferences')).data.find((row: { key: string }) => row.key === 'history').value).enabled, false)
  await request(`clipboard-entries/${fresh.id}`, undefined, 'DELETE')
  assert.equal((await request('clipboard-entries')).data.length, 0)
  await request('clipboard-entries', { content: 'x'.repeat(20001), capturedAt: Date.now() }, 'POST', 422)
  assert.equal((await request('clipboard-entries')).data.length, 0)
  assert.equal((await request('commands')).data[0].id, snippet.id)
  await stop()
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ authenticatedPackagedBackend: true, productionHistoryRoutes: true, retentionPruning: true, nativeModelValidation: true, clearRemovesClipboardRankingOnly: true, snippetSurvivesClearAndRestart: true, preferenceAndHistoryPersistAcrossRestart: true }))
}
finally {
  if (child && child.exitCode === null) {
    child.kill()
    await child.exited
  }
  rmSync(profile, { recursive: true, force: true })
}
