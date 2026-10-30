import { expect, test } from 'bun:test'
import { defaultSearchSettings, readSearchSettings, webEngines } from '../resources/functions/search-settings'
import { webSearchResult } from '../resources/functions/web-search'
import { quicklinkUrl } from '../resources/functions/search'

test('search settings default safely and ignore damaged or unknown values', () => {
  expect(readSearchSettings(undefined)).toEqual(defaultSearchSettings)
  expect(readSearchSettings('{')).toEqual(defaultSearchSettings)
  expect(readSearchSettings('{"files":false,"currency":true,"web":"google","paste":true}')).toEqual({ files: false, currency: true, web: 'google', paste: true })
  expect(readSearchSettings('{"files":"no","currency":"yes","web":"altavista","paste":1}')).toEqual(defaultSearchSettings)
  expect(readSearchSettings('{"web":"off"}').web).toBe('off')
})

test('the web fallback is a bounded row that every engine can turn into an https address', () => {
  expect(webSearchResult('  ', 'google')).toBeNull()
  expect(webSearchResult('cats', 'off')).toBeNull()
  const long = webSearchResult('x'.repeat(200), 'duckduckgo')!
  expect(long.title.length).toBeLessThanOrEqual(21 + 80 + 2)
  expect(long.title).toContain('…')
  for (const engine of Object.keys(webEngines) as (keyof typeof webEngines)[]) {
    const row = webSearchResult('cats & dogs', engine)!
    expect(row.kind).toBe('web')
    expect(quicklinkUrl(row.content, 'cats & dogs')).toStartWith('https://')
    expect(quicklinkUrl(row.content, 'cats & dogs')).toContain('cats%20%26%20dogs')
  }
})

test('an inherited property name is not a search engine', () => {
  expect(readSearchSettings('{"web":"constructor"}').web).toBe(defaultSearchSettings.web)
  expect(readSearchSettings('{"web":"__proto__"}').web).toBe(defaultSearchSettings.web)
})
