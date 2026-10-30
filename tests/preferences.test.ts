import { expect, test } from 'bun:test'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'
import { historyPreference, parsePreference } from '../resources/functions/preferences'

test('damaged preference values fall back instead of throwing', () => {
  expect(parsePreference('{"enabled":true}')).toEqual({ enabled: true })
  for (const value of [undefined, '', '{', 'null', '[1]', '"text"', '7']) expect(parsePreference(value)).toEqual({})
})

test('history preferences accept only known retention periods', () => {
  expect(historyPreference('{"enabled":true,"days":30}')).toEqual({ enabled: true, days: 30 })
  expect(historyPreference('{"enabled":"yes","days":14}')).toEqual({ enabled: false, days: 7 })
  expect(historyPreference('not json')).toEqual({ enabled: false, days: 7 })
})

test('clearing the GitHub scope can be saved while oversized values are still refused', async () => {
  const models = { AppPreference }
  const database = openNativeDatabase({ path: ':memory:', models })
  try {
    const api = createNativeModelApi({ models, authorize: () => true })
    const post = (value: string) => api(new Request('http://localhost/api/preferences', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'githubScope', value }) }))
    expect((await post(''))?.status).toBe(201)
    expect((await post('x'.repeat(1001)))?.status).toBe(422)
  }
  finally { database.close() }
})
