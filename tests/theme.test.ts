import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  builtInTheme, defaultFont, defaultFontStack, isBuiltInTheme, isThemeColor, maxFontSize, minFontSize,
  parseThemeDocument, readFontFamily, readFontSize, readStoredTheme, readTheme, readThemeColors,
  serializeTheme, themeFontVariables, themeTokens, themeVariables,
} from '../resources/functions/theme'

test('only plain hex colours are accepted', () => {
  for (const good of ['#fff', '#FFF', '#245eb7', '#245EB7', ' #abc ']) expect(isThemeColor(good)).toBe(true)
  // Anything that could carry more than a colour is refused, so a value can never reference a URL or another variable.
  for (const bad of ['', 'red', '#ff', '#ffff', '#12345', '#1234567', 'rgb(0,0,0)', 'var(--ink)', 'url(x)', '#fff;}', null, 7, {}])
    expect(isThemeColor(bad)).toBe(false)
})

test('every token is filled, from the saved value or the built-in one', () => {
  const colors = readThemeColors({ surface: '#000000', ink: 'not a colour' }, builtInTheme.light)
  expect(colors.surface).toBe('#000000')
  expect(colors.ink).toBe(builtInTheme.light.ink)
  expect(Object.keys(colors).sort()).toEqual([...themeTokens].sort())
  // A hex value is stored one way, so two spellings of the same colour compare equal.
  expect(readThemeColors({ surface: ' #ABCDEF ' }, builtInTheme.light).surface).toBe('#abcdef')
  for (const bad of [null, 'text', [], 7]) expect(readThemeColors(bad, builtInTheme.dark)).toEqual(builtInTheme.dark)
})

test('a font family keeps its separators and loses everything else', () => {
  expect(readFontFamily('Helvetica Neue, system-ui')).toBe('Helvetica Neue, system-ui')
  expect(readFontFamily('Menlo"; background: url(x)')).toBe('Menlo" background urlx')
  expect(readFontFamily('a'.repeat(400))).toHaveLength(200)
  for (const bad of [null, 7, {}]) expect(readFontFamily(bad)).toBe(defaultFont.family)
})

test('a font size is clamped to what still fits the window', () => {
  expect(readFontSize(13)).toBe(13)
  expect(readFontSize('15')).toBe(15)
  expect(readFontSize(13.4)).toBe(13)
  expect(readFontSize(2)).toBe(minFontSize)
  expect(readFontSize(99)).toBe(maxFontSize)
  for (const bad of ['', 'big', null, Number.NaN, Number.POSITIVE_INFINITY]) expect(readFontSize(bad)).toBe(defaultFont.size)
})

test('a theme reads from an object or its stored JSON, and survives nonsense', () => {
  const theme = readTheme({ name: ' Midnight ', light: { surface: '#111111' }, font: { family: 'Menlo', size: 40 } })
  expect(theme.name).toBe('Midnight')
  expect(theme.light.surface).toBe('#111111')
  expect(theme.dark).toEqual(builtInTheme.dark)
  expect(theme.font).toEqual({ family: 'Menlo', size: maxFontSize })
  expect(readTheme(serializeTheme(theme))).toEqual(theme)
  for (const bad of ['', 'not json', '[]', null, 7]) expect(readTheme(bad)).toEqual(builtInTheme)
  expect(readTheme({}, 'Fallback').name).toBe('Fallback')
})

test('variables are named as the stylesheet names them', () => {
  const variables = themeVariables(builtInTheme, 'dark')
  expect(variables['--surface']).toBe(builtInTheme.dark.surface)
  expect(Object.keys(variables)).toHaveLength(themeTokens.length)
  expect(Object.keys(variables).every(name => name.startsWith('--'))).toBe(true)
  expect(themeVariables(builtInTheme, 'light')['--surface']).toBe(builtInTheme.light.surface)
})

test('type variables fall back to the stylesheet stack and carry a unit', () => {
  expect(themeFontVariables(builtInTheme)).toEqual({ '--font-family': defaultFontStack, '--font-size': '13px' })
  const themed = readTheme({ font: { family: 'Menlo', size: 16 } })
  expect(themeFontVariables(themed)).toEqual({ '--font-family': 'Menlo', '--font-size': '16px' })
})

test('a stored row is read back with each part parsed from its JSON', () => {
  const stored = { name: 'Midnight', light: JSON.stringify({ surface: '#111111' }), dark: JSON.stringify({ ink: '#eeeeee' }), font: JSON.stringify({ size: 15 }) }
  const theme = readStoredTheme(stored)
  expect(theme.name).toBe('Midnight')
  expect(theme.light.surface).toBe('#111111')
  expect(theme.dark.ink).toBe('#eeeeee')
  expect(theme.font.size).toBe(15)
  // A row written before a column existed, or holding something unreadable, still produces a usable theme.
  expect(readStoredTheme({ name: 'Broken', light: 'not json', dark: undefined, font: '' })).toEqual({ ...builtInTheme, name: 'Broken' })
})

test('the built-in theme is recognised so the app knows it has nothing to apply', () => {
  expect(isBuiltInTheme(builtInTheme)).toBe(true)
  expect(isBuiltInTheme(readTheme({ light: { accent: '#ff0000' } }))).toBe(false)
  expect(isBuiltInTheme(readTheme({ font: { size: 16 } }))).toBe(false)
})

test('a shared theme is checked rather than quietly corrected', () => {
  const good = parseThemeDocument(JSON.stringify({ name: 'Midnight', light: { surface: '#111111' } }))
  expect(good.ok).toBe(true)
  if (good.ok) {
    expect(good.theme.name).toBe('Midnight')
    expect(good.theme.light.surface).toBe('#111111')
    // What the document does not mention keeps the built-in value instead of being blanked.
    expect(good.theme.dark).toEqual(builtInTheme.dark)
  }
  const errorsFor = (text: string) => {
    const result = parseThemeDocument(text)
    return result.ok ? [] : result.errors
  }
  expect(errorsFor('')).toEqual(['Paste a theme first.'])
  expect(errorsFor('   ')).toEqual(['Paste a theme first.'])
  expect(errorsFor('{nope')).toEqual(['That is not valid JSON.'])
  expect(errorsFor('[]')).toEqual(['A theme is a JSON object.'])
  expect(errorsFor('"text"')).toEqual(['A theme is a JSON object.'])
  expect(errorsFor('{}')).toEqual(['A theme needs light or dark colours.'])
  expect(errorsFor(JSON.stringify({ light: 'blue' }))).toEqual(['"light" is a set of colours.'])
  expect(errorsFor(JSON.stringify({ light: { surface: 'red' } }))[0]).toContain('not a hex colour')
  expect(errorsFor(JSON.stringify({ light: { nonsense: '#fff' } }))[0]).toContain('not a colour this palette uses')
  // A document full of mistakes reports a readable number of them, not one per token.
  expect(errorsFor(JSON.stringify({ light: Object.fromEntries(themeTokens.map(token => [token, 'red'])) })).length).toBeLessThanOrEqual(8)
})

// The built-in values are a copy of what the stylesheet ships. If the stylesheet moves on, a theme would quietly
// restore the old colours, so the copy is checked against the source rather than trusted.
test('the built-in values match the stylesheet', () => {
  const source = readFileSync(join(import.meta.dir, '..', 'resources', 'views', 'launcher.stx'), 'utf8')
  const read = (selector: string) => {
    const line = source.split(/\r?\n/).find(row => row.trimStart().startsWith(`${selector} {`) && row.includes('--surface'))
    if (!line) throw new Error(`${selector} was not found in the stylesheet`)
    return Object.fromEntries([...line.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{3,6})/gi)].map(match => [match[1], match[2]!.toLowerCase()]))
  }
  expect(read(':root')).toMatchObject(builtInTheme.light)
  expect(read(':root.dark')).toMatchObject(builtInTheme.dark)
})
