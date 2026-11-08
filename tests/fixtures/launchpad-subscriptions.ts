import assert from 'node:assert/strict'
import { join } from 'node:path'
import { db } from '@stacksjs/database/runtime'
import { lists, subscribe } from '@stacksjs/newsletter'
import { subscribeToLaunchpad } from '../../app/Services/launchpad-subscriptions'
import { models } from '../../app/Desktop/models'
async function verify() {
  const migrate = Bun.spawn(['./buddy', 'migrate', '--generate'], { cwd: join(import.meta.dir, '../..'), env: process.env, stdout: 'pipe', stderr: 'pipe' })
  const [status, output, error] = await Promise.all([migrate.exited, new Response(migrate.stdout).text(), new Response(migrate.stderr).text()])
  assert.equal(status, 0, `${output}\n${error}`)
  const tables = await db.unsafe("SELECT name FROM sqlite_master WHERE type='table'").execute() as { name: string }[]
  assert.ok(tables.some(table => table.name === 'subscribers'))
  for (const model of Object.values(models)) assert.ok(!tables.some(table => table.name === model.table), `${model.table} must stay local to the desktop`)
  const probe = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: () => new Response('port probe') })
  const port = probe.port
  probe.stop(true)
  const server = Bun.spawn(['./buddy', 'serve:api'], { cwd: join(import.meta.dir, '../..'), env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), PORT_API: String(port) }, stdout: 'pipe', stderr: 'pipe' })
  const outputLog = new Response(server.stdout).text()
  const errorLog = new Response(server.stderr).text()
  const origin = `http://127.0.0.1:${port}`
  const url = `${origin}/api/subscribe`
  const submit = (email: string) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
  let verified = false
  try {
    let ready = false
    for (let attempt = 0; attempt < 200 && server.exitCode === null; attempt++) {
      try {
        const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })
        if (health.ok && (await health.json()).service === 'launchpad-api') {
          ready = true
          break
        }
      }
      catch { /* The real production entry is still booting. */ }
      await Bun.sleep(100)
    }
    assert.ok(ready, 'The production API entry did not become ready on its declared loopback port')
    for (const model of Object.values(models)) {
      const uri = model.traits.useApi.uri
      assert.equal((await fetch(`${origin}/api/${uri}`)).status, 404, `${uri} must stay local to the desktop`)
    }
    for (const uri of ['users', 'subscribers', 'email-lists', 'email-list-subscribers']) {
      assert.equal((await fetch(`${origin}/api/${uri}`)).status, 401, `${uri} records require authentication`)
    }
    const directCreate = await fetch(`${origin}/api/subscribers`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'direct@example.com' }) })
    assert.equal(directCreate.status, 401, 'The public subscription action must not expose model creation')
    const invalid = await submit('invalid')
    assert.equal(invalid.status, 422)
    assert.equal((await db.selectFrom('subscribers').selectAll().execute()).length, 0)
    const response = await submit('http@example.com')
    assert.equal(response.status, 200, await response.clone().text())
    assert.deepEqual(await response.json(), { success: true, message: 'You’re subscribed to Launchpad updates.' })
    const repeatResponse = await submit('HTTP@example.com')
    assert.equal(repeatResponse.status, 200)
    assert.equal((await db.selectFrom('subscribers').selectAll().where('email', '=', 'http@example.com').execute()).length, 1)

    await lists.create({ name: 'Stacks updates', slug: 'stacks-updates' })
    await subscribe('person@example.com', { list: 'stacks-updates' })
    const first = await subscribeToLaunchpad(' Person@EXAMPLE.com ')
    const repeat = await subscribeToLaunchpad('person@example.com')
    assert.equal(first.created, true)
    assert.equal(repeat.created, false)
    assert.equal(first.token, repeat.token)
    assert.equal((await db.selectFrom('subscribers').selectAll().execute()).length, 2)
    const removed = await fetch(`${origin}/api/email/unsubscribe?token=${first.token}`)
    assert.equal(removed.status, 200)
    assert.ok((await removed.text()).includes('Unsubscribed'))
    const memberships = await db.selectFrom('email_list_subscribers').selectAll().execute()
    assert.equal(memberships.length, 3)
    assert.equal(memberships.filter(row => Number(row.email_list_id) === first.listId && row.status === 'unsubscribed').length, 1)
    assert.equal(memberships.filter(row => Number(row.email_list_id) !== first.listId && row.status === 'subscribed').length, 1)
    const attempts = []
    for (let index = 0; index < 10; index++) attempts.push(await submit('http@example.com'))
    assert.equal(attempts.at(-1)?.status, 429)
    assert.ok(Number(attempts.at(-1)?.headers.get('retry-after')) > 0)
    assert.equal((await db.selectFrom('subscribers').selectAll().execute()).length, 2)
    verified = true
    // eslint-disable-next-line no-console
    console.log('Native Launchpad subscription and scoped unsubscribe verified')
  }
  finally {
    server.kill()
    await server.exited
    const [stdout, stderr] = await Promise.all([outputLog, errorLog])
    if (!verified) {
      // eslint-disable-next-line no-console
      console.error(stdout, stderr)
    }
  }
}

verify().catch((error) => { throw error })
