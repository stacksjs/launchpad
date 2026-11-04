import { expect, test } from 'bun:test'
import {
  detailFor, detailMinimum, detailOutline, maxDetailBlocks,
  maxDetailLength, parseDetail,
} from '../resources/functions/detail'

const long = (text: string) => text.padEnd(detailMinimum + 10, ' x')

test('plain prose stays prose, joined into paragraphs by its blank lines', () => {
  expect(parseDetail('one\ntwo\n\nthree')).toEqual([
    { kind: 'paragraph', text: 'one two' },
    { kind: 'paragraph', text: 'three' },
  ])
  expect(parseDetail('')).toEqual([])
  expect(parseDetail('   \n  \n')).toEqual([])
})

test('headings, rules and quotes are read as themselves', () => {
  expect(parseDetail('# Title\n## Sub\n#### Too deep')).toEqual([
    { kind: 'heading', level: 1, text: 'Title' },
    { kind: 'heading', level: 2, text: 'Sub' },
    // Only three levels are recognised; anything deeper is prose that happens to start with hashes.
    { kind: 'paragraph', text: '#### Too deep' },
  ])
  expect(parseDetail('---')).toEqual([{ kind: 'rule' }])
  expect(parseDetail('> one\n> two')).toEqual([{ kind: 'quote', text: 'one two' }])
})

test('a fenced block keeps its own line breaks and spacing', () => {
  const blocks = parseDetail('before\n\n```ts\nconst a = 1\n  indented\n```\nafter')
  expect(blocks[1]).toEqual({ kind: 'code', text: 'const a = 1\n  indented', language: 'ts' })
  expect(blocks[2]).toEqual({ kind: 'paragraph', text: 'after' })
  // An unterminated fence still yields its content rather than swallowing the rest as prose.
  expect(parseDetail('```\nstill code')[0]).toEqual({ kind: 'code', text: 'still code', language: '' })
})

test('both kinds of list are gathered into one block', () => {
  expect(parseDetail('- one\n- two\n* three')).toEqual([{ kind: 'list', ordered: false, items: ['one', 'two', 'three'] }])
  expect(parseDetail('1. one\n2) two')).toEqual([{ kind: 'list', ordered: true, items: ['one', 'two'] }])
  // A list ends where the prose resumes.
  const mixed = parseDetail('- one\n\nafter')
  expect(mixed.map(block => block.kind)).toEqual(['list', 'paragraph'])
})

test('an image is kept only when a browser could fetch it', () => {
  expect(parseDetail('![a cat](https://example.com/cat.png)')).toEqual([{ kind: 'image', url: 'https://example.com/cat.png', alt: 'a cat' }])
  // A data: or file: image would carry content the palette never vetted, so it stays as the text it was.
  for (const bad of ['data:image/png;base64,AAAA', 'file:///etc/passwd', 'javascript:alert(1)']) {
    const blocks = parseDetail(`![x](${bad})`)
    expect(blocks[0]!.kind).toBe('paragraph')
  }
})

test('a document far too long is read from its beginning, and never without bound', () => {
  const blocks = parseDetail('para\n\n'.repeat(maxDetailBlocks + 50))
  expect(blocks.length).toBeLessThanOrEqual(maxDetailBlocks)
  expect(parseDetail('a'.repeat(maxDetailLength + 5000))[0]!.kind).toBe('paragraph')
})

test('headings become places to jump to', () => {
  const blocks = parseDetail('intro\n\n# One\nbody\n\n## Two')
  expect(detailOutline(blocks)).toEqual([
    { index: 1, text: 'One', level: 1 },
    { index: 3, text: 'Two', level: 2 },
  ])
  expect(detailOutline(parseDetail('no headings here'))).toEqual([])
})

test('only what the palette holds, and only when a row cannot say it', () => {
  const held = (kind: string, content: string) => detailFor({ kind, title: 'T', subtitle: 'S', content })
  expect(held('clipboard', long('a note'))).toMatchObject({ title: 'T', subtitle: 'S' })
  expect(held('snippet', long('a snippet'))).not.toBeNull()
  // A short entry already shows all of itself in its row.
  expect(held('clipboard', 'short')).toBeNull()
  // A file is opened by its own application rather than previewed here, and a command is not a document.
  for (const kind of ['file', 'application', 'system', 'bookmark', 'music']) expect(held(kind, long('x'))).toBeNull()
  expect(detailFor(undefined)).toBeNull()
})
