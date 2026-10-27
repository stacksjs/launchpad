import { expect, test } from 'bun:test'
import { initializeLogin, setLoginEnabled } from '../resources/functions/startup'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'

test('first startup registers at login once and later respects a user disabling it in macOS', async () => {
  let enabled = false
  let registrations = 0
  let remembered = false
  const service = {
    isEnabled: async () => enabled,
    enable: async () => { registrations++; enabled = true; return true },
    disable: async () => { enabled = false; return true },
  }
  expect(await initializeLogin(service, remembered, async () => { remembered = true })).toBe(true)
  expect(remembered).toBe(true)
  enabled = false
  expect(await initializeLogin(service, remembered, async () => { remembered = true })).toBe(false)
  expect(registrations).toBe(1)
  expect(await setLoginEnabled(service, true)).toBe(true)
  expect(await setLoginEnabled(service, false)).toBe(false)
})

test('failed registration is not saved as success and pending approval reports the actual OS state', async () => {
  let remembered = false
  const service = { isEnabled: async () => false, enable: async () => false, disable: async () => false }
  await expect(initializeLogin(service, false, async () => { remembered = true })).rejects.toThrow('Could not register')
  expect(remembered).toBe(false)
  expect(await initializeLogin({ ...service, enable: async () => true }, false, async () => { remembered = true })).toBe(false)
  expect(remembered).toBe(true)
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
