import { expect, test } from 'bun:test'
import { maxSelectionLength, readSelection, selectionActions, selectionLabel } from '../resources/functions/selection'

test('a web address on its own is recognised as one', () => {
  expect(readSelection({ type: 'text', value: 'https://example.com/docs' })).toEqual({ kind: 'url', value: 'https://example.com/docs' })
  expect(readSelection({ type: 'url', value: '  http://example.com  ' })).toEqual({ kind: 'url', value: 'http://example.com' })
  // More than one line, or words around it, is prose that happens to contain a link.
  expect(readSelection({ value: 'see https://example.com for more' }).kind).toBe('text')
  // Only what a browser can open; the row opens through the shell.
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'mailto:a@b.c'])
    expect(readSelection({ value: bad }).kind).not.toBe('url')
})

test('a path is recognised when it says where it starts', () => {
  expect(readSelection({ value: '/Users/ada/notes.md' }).kind).toBe('path')
  expect(readSelection({ value: '~/Documents' }).kind).toBe('path')
  // A relative path has no meaning outside the folder it was written in.
  for (const text of ['notes.md', 'docs/intro.md', '/', '', '  ']) expect(readSelection({ value: text }).kind).not.toBe('path')
  expect(readSelection({ value: '/Users/ada/a\nb' }).kind).toBe('text')
})

test('nothing to act on is nothing, not an empty action list', () => {
  for (const payload of [null, undefined, {}, { value: '' }, { value: '   ' }, { type: 'none', value: 'x' }])
    expect(readSelection(payload)).toEqual({ kind: 'none', value: '' })
  expect(selectionActions({ kind: 'none', value: '' })).toEqual([])
})

test('a whole document never becomes a query', () => {
  const selection = readSelection({ value: 'a'.repeat(5000) })
  expect(selection.value).toHaveLength(maxSelectionLength)
  expect(selection.kind).toBe('text')
})

test('a selection is shown back on one line', () => {
  expect(selectionLabel('  one   two\nthree  ')).toBe('one two three')
  expect(selectionLabel('a'.repeat(100))).toHaveLength(61)
  expect(selectionLabel('a'.repeat(100)).endsWith('…')).toBe(true)
  expect(selectionLabel('short', 10)).toBe('short')
})

test('text earns a copy row, and the palette search handles the rest', () => {
  const rows = selectionActions(readSelection({ value: 'sales figures' }))
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ kind: 'clipboard', content: 'sales figures' })
  expect(rows[0]!.title).toBe('Copy “sales figures”')
})

test('a link and a path each earn the row that opens them', () => {
  const link = selectionActions(readSelection({ value: 'https://example.com/docs' }))
  expect(link.map(row => row.kind)).toEqual(['quicklink', 'clipboard'])
  expect(link[0]!.content).toBe('https://example.com/docs')
  const path = selectionActions(readSelection({ value: '/Users/ada/notes.md' }))
  expect(path.map(row => row.kind)).toEqual(['file', 'clipboard'])
  expect(path[0]).toMatchObject({ content: '/Users/ada/notes.md', detail: '/Users/ada/notes.md' })
  // Copying is offered whatever the selection is, because it is the one action that always applies.
  expect(link[1]!.key).toBe('selection:copy')
  expect(path[1]!.key).toBe('selection:copy')
})
