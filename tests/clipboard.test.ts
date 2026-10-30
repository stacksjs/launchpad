import { expect, test } from 'bun:test'
import { clipboardDecision, clipboardTitle, maxClipboardText } from '../resources/functions/clipboard'

test('only usable text within the model limit is saved', () => {
  expect(clipboardDecision('copied')).toBe('save')
  expect(clipboardDecision('x'.repeat(maxClipboardText))).toBe('save')
  expect(clipboardDecision('x'.repeat(maxClipboardText + 1))).toBe('too-large')
  for (const text of [undefined, null, '', ' \n\t ']) expect(clipboardDecision(text)).toBe('empty')
})

test('clipboard titles are one clean line that never splits an emoji', () => {
  expect(clipboardTitle('\n\n  first   line\nsecond')).toBe('first line second')
  const title = clipboardTitle('😀'.repeat(150))
  expect(Array.from(title)).toHaveLength(100)
  expect(title).toBe('😀'.repeat(100))
  expect(clipboardTitle('')).toBe('')
})
