import { expect, test } from 'bun:test'
import { initializeLogin, setLoginEnabled } from '../resources/functions/startup'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'

test('startup only reads Login Items and respects changes made outside Launchpad', async () => {
  let enabled = false
  let registrations = 0
  let remembered = false
  const service = {
    isEnabled: async () => enabled,
    enable: async () => { registrations++; enabled = true; return true },
    disable: async () => { enabled = false; return true },
  }
  expect(await initializeLogin(service, remembered, async () => { remembered = true })).toBe(false)
  expect(remembered).toBe(true)
  expect(registrations).toBe(0)
  expect(await setLoginEnabled(service, true)).toBe(true)
  enabled = false
  expect(await initializeLogin(service, remembered, async () => { remembered = true })).toBe(false)
  expect(registrations).toBe(1)
  expect(await setLoginEnabled(service, true)).toBe(true)
  expect(await setLoginEnabled(service, false)).toBe(false)
})

test('registration requires the explicit setting and pending approval reports the actual OS state', async () => {
  const service = { isEnabled: async () => false, enable: async () => false, disable: async () => false }
  expect(await setLoginEnabled({ ...service, enable: async () => true }, true)).toBe(false)
  await expect(setLoginEnabled(service, true)).rejects.toThrow('macOS could not update')
})

test('login initialization persists through the generated Stacks preference API', async () => {
  const models = { AppPreference }
  const db = openNativeDatabase({ path: ':memory:', models })
  try {
    const api = createNativeModelApi({ models, authorize: () => true })
    const response = await api(new Request('http://localhost/api/preferences', { method: 'POST', body: JSON.stringify({ key: 'loginInitialized', value: 'true' }) }))
    expect(response?.status).toBe(201)
    expect((await AppPreference.where('key', 'loginInitialized').first())?.value).toBe('true')
  }
  finally { db.close() }
})
