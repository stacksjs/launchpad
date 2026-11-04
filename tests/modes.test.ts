import { expect, test } from 'bun:test'
import { modeById, modeResults, modes } from '../resources/functions/modes'
import { categoryOrder } from '../resources/functions/launcher-results'
import { idleVisible } from '../resources/functions/result-list'
import { createResultSearch } from '../resources/functions/search'

test('every mode names a real category, and every category but All has a way in', () => {
  const ids = modes.map(mode => mode.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ids) expect(categoryOrder as readonly string[]).toContain(id)
  // Removing the tab strip left search as the only route, so nothing may be missing from it.
  for (const category of categoryOrder) if (category !== 'all') expect(ids).toContain(category)
})

test('unknown identifiers never switch the palette', () => {
  expect(modeById('clipboard')?.title).toBe('Clipboard History')
  for (const bad of ['', 'all', 'ALL', 'nonsense', '__proto__', 'constructor']) expect(modeById(bad)).toBeNull()
})

test('the words people reach for find the mode', () => {
  const search = createResultSearch([...modeResults()])
  const first = (query: string) => search(query)[0]?.content
  expect(first('clipboard')).toBe('clipboard')
  expect(first('emoji')).toBe('emoji')
  expect(first('windows')).toBe('window')
  expect(first('contacts')).toBe('contact')
  expect(first('calendar')).toBe('event')
  expect(first('packages')).toBe('pantry')
  expect(first('apps')).toBe('application')
})

test('modes stay out of the idle list, which is for your own things', () => {
  for (const row of modeResults()) expect(idleVisible(row)).toBe(false)
  expect(modeResults().every(row => row.kind === 'mode' && row.key === `mode:${row.content}`)).toBe(true)
})
