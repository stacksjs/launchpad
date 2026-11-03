import { expect, test } from 'bun:test'
import {
  breadcrumb, browseEntries, browseResults, isWithin, maxBrowseEntries,
  normalizePath, parentPath, sortEntries, visibleEntries,
} from '../resources/functions/browse'

const entry = (name: string, isDirectory = false, folder = '/Users/ada') => ({ name, path: `${folder}/${name}`, isDirectory })

test('a path has one spelling, however it was written', () => {
  expect(normalizePath('/Users/ada/')).toBe('/Users/ada')
  expect(normalizePath('/Users/ada///')).toBe('/Users/ada')
  expect(normalizePath('/')).toBe('/')
  expect(normalizePath('')).toBe('/')
})

test('stepping up leads to the holding folder, and the root holds itself', () => {
  expect(parentPath('/Users/ada/Documents')).toBe('/Users/ada')
  expect(parentPath('/Users/ada/Documents/')).toBe('/Users/ada')
  expect(parentPath('/Users')).toBe('/')
  // Otherwise stepping up from the root would walk off the top.
  expect(parentPath('/')).toBe('/')
  expect(parentPath('')).toBe('/')
})

test('browsing stays inside the home directory', () => {
  const home = '/Users/ada'
  expect(isWithin('/Users/ada', home)).toBe(true)
  expect(isWithin('/Users/ada/Documents/notes', home)).toBe(true)
  expect(isWithin('/Users/ada/', home)).toBe(true)
  // A launcher walking up into the system is a surprise, and in the sandboxed build a wall.
  expect(isWithin('/Users', home)).toBe(false)
  expect(isWithin('/', home)).toBe(false)
  expect(isWithin('/Users/adam', home)).toBe(false)
  expect(isWithin('/etc/passwd', home)).toBe(false)
})

test('hidden items are left out, as file search already leaves them out', () => {
  const entries = [entry('.ssh', true), entry('notes.md'), entry('.DS_Store'), { name: '', path: '/x', isDirectory: false }]
  expect(visibleEntries(entries).map(item => item.name)).toEqual(['notes.md'])
})

test('folders come first, then files, each by name', () => {
  const entries = [entry('zebra.txt'), entry('Projects', true), entry('apple.txt'), entry('archive', true)]
  expect(sortEntries(entries).map(item => item.name)).toEqual(['archive', 'Projects', 'apple.txt', 'zebra.txt'])
  // Numbers read as numbers, so a tenth item does not sort beside the first.
  expect(sortEntries([entry('file10'), entry('file2')]).map(item => item.name)).toEqual(['file2', 'file10'])
})

test('a listing is bounded, because a folder can hold more than anyone reads', () => {
  const many = Array.from({ length: maxBrowseEntries + 200 }, (_, index) => entry(`file${index}.txt`))
  expect(browseEntries(many)).toHaveLength(maxBrowseEntries)
  expect(browseEntries([entry('.hidden'), entry('b.txt'), entry('A', true)]).map(item => item.name)).toEqual(['A', 'b.txt'])
})

test('a path is shown the way someone would write it', () => {
  const home = '/Users/ada'
  expect(breadcrumb('/Users/ada', home)).toBe('~')
  expect(breadcrumb('/Users/ada/', home)).toBe('~')
  expect(breadcrumb('/Users/ada/Documents/Work', home)).toBe('~/Documents/Work')
  // Somewhere outside home has no tilde to offer, so it is shown as it is.
  expect(breadcrumb('/etc', home)).toBe('/etc')
})

test('rows say which are folders and where they sit', () => {
  const rows = browseResults([entry('Projects', true), entry('notes.md')], '/Users/ada')
  expect(rows[0]).toMatchObject({ kind: 'file', title: 'Projects', content: '/Users/ada/Projects' })
  expect(rows[0]!.subtitle).toBe('Folder · ~')
  // A folder is stepped into rather than opened, so the row has to say which it is.
  expect(rows[0]!.directory).toBe(true)
  expect(rows[1]!.directory).toBe(false)
  expect(rows[1]!.subtitle).toBe('~')
  expect(rows[1]!.detail).toBe('/Users/ada/notes.md')
  // The key matches what file search produces, so the same row cannot appear twice under two keys.
  expect(rows[0]!.key).toBe('file:/Users/ada/Projects')
})
