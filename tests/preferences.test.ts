import { expect, test } from 'bun:test'
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
