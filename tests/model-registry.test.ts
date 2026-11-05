import { expect, test } from 'bun:test'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import { models } from '../app/Desktop/models'

const directory = join(import.meta.dir, '..', 'app', 'Models')

/**
 * A model file with no entry in the registry has no table and no endpoints. The interface asks for them by name and
 * fails at the first request, so the only thing standing between a new model and a broken feature is this list.
 */
test('every model file is in the backend registry', () => {
  const files = readdirSync(directory).filter(name => name.endsWith('.ts')).map(name => name.slice(0, -3)).sort()
  expect(Object.keys(models).sort()).toEqual(files)
})

test('the registry serves the endpoints the interface asks for', async () => {
  openNativeDatabase({ path: ':memory:', models })
  const api = createNativeModelApi({ models, authorize: () => true })
  // Each of these is fetched by name in `resources/views/launcher.stx`.
  for (const uri of ['commands', 'launch-records', 'clipboard-entries', 'preferences', 'themes', 'extensions', 'exchange-rates', 'activity-events', 'usage-days', 'usage-periods', 'pantry-installations']) {
    const response = await api(new Request(`http://launchpad.test/api/${uri}`))
    expect(response, `/api/${uri} is not served`).not.toBeNull()
    expect(response!.status, `/api/${uri}`).toBe(200)
  }
})
