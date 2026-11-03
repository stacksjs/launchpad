import { expect, test } from 'bun:test'
import {
  largeTypeFontSize, largeTypeText, maxLargeTypeLength, maxLargeTypeSize, minLargeTypeSize,
} from '../resources/functions/large-type'

test('a result whose point is its text shows that text', () => {
  expect(largeTypeText({ kind: 'snippet', title: 'Address', content: '12 Mill Lane' })).toBe('12 Mill Lane')
  expect(largeTypeText({ kind: 'clipboard', title: 'Copied', content: 'abc-123' })).toBe('abc-123')
  expect(largeTypeText({ kind: 'calculator', title: '42', content: '42' })).toBe('42')
  // An emoji row's title carries its name too, which is not what anyone wants filling the window.
  expect(largeTypeText({ kind: 'emoji', title: '🚀  rocket', content: '🚀' })).toBe('🚀')
})

test('everything else is named by its title', () => {
  // The content is a path or an address the title already stands for.
  expect(largeTypeText({ kind: 'application', title: 'Safari', content: '/Applications/Safari.app' })).toBe('Safari')
  expect(largeTypeText({ kind: 'bookmark', title: 'Docs', content: 'https://example.com' })).toBe('Docs')
  expect(largeTypeText({ kind: 'file', title: 'notes.md', content: '/Users/ada/notes.md' })).toBe('notes.md')
})

test('missing or oversized text is handled rather than shown', () => {
  expect(largeTypeText(null)).toBe('')
  expect(largeTypeText(undefined)).toBe('')
  expect(largeTypeText({ kind: 'snippet', title: 'Fallback', content: '' })).toBe('Fallback')
  expect(largeTypeText({ kind: 'application', title: '', content: '/path' })).toBe('/path')
  expect(largeTypeText({ kind: 'snippet', title: 'x', content: '  spaced  ' })).toBe('spaced')
  // Past this it is a document, which the result list already shows better.
  expect(largeTypeText({ kind: 'snippet', title: 'x', content: 'a'.repeat(1000) })).toHaveLength(maxLargeTypeLength)
})

test('short text fills the window and long text steps down to fit', () => {
  const short = largeTypeFontSize('42', 600, 300)
  const medium = largeTypeFontSize('a'.repeat(40), 600, 300)
  const long = largeTypeFontSize('a'.repeat(400), 600, 300)
  expect(short).toBeGreaterThan(medium)
  expect(medium).toBeGreaterThan(long)
  expect(short).toBeLessThanOrEqual(maxLargeTypeSize)
  expect(long).toBeGreaterThanOrEqual(minLargeTypeSize)
})

test('the chosen size actually fits the box it was given', () => {
  const fits = (text: string, width: number, height: number) => {
    const size = largeTypeFontSize(text, width, height)
    const perLine = Math.floor(width / (size * 0.6))
    if (perLine < 1) return size === minLargeTypeSize
    const lines = text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0)
    return lines * size * 1.25 <= height || size === minLargeTypeSize
  }
  for (const text of ['42', 'a short line', 'a'.repeat(120), 'a'.repeat(600), 'one\ntwo\nthree'])
    for (const [width, height] of [[600, 300], [320, 200], [1200, 700], [200, 120]])
      expect(fits(text, width!, height!)).toBe(true)
})

test('a line someone typed as its own line stays one', () => {
  // Three short lines need more height than the same characters on one, so the size has to come down.
  expect(largeTypeFontSize('one\ntwo\nthree', 600, 300)).toBeLessThan(largeTypeFontSize('onetwothree', 600, 300))
})

test('nothing to show, or nowhere to show it, falls back to the smallest size', () => {
  for (const [text, width, height] of [['', 600, 300], ['   ', 600, 300], ['x', 0, 300], ['x', 600, 0], ['x', -10, -10]])
    expect(largeTypeFontSize(text as string, width as number, height as number)).toBe(minLargeTypeSize)
})
