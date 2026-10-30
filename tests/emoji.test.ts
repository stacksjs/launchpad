import { expect, test } from 'bun:test'
import { emojiData } from '../resources/functions/emoji-data'
import { emojiQuery, emojiResults } from '../resources/functions/emoji'
import { createResultSearch } from '../resources/functions/search'

test('the emoji catalog has no duplicates and every entry is searchable', () => {
  const characters = emojiData.map(([character]) => character)
  expect(new Set(characters).size).toBe(characters.length)
  expect(emojiData.length).toBeGreaterThan(300)
  for (const [character, name, keywords] of emojiData) {
    expect(character.length).toBeGreaterThan(0)
    expect(name.trim()).toBe(name)
    expect(name.length).toBeGreaterThan(2)
    expect(keywords.trim()).toBe(keywords)
    expect(/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(character)).toBe(true)
  }
})

test('familiar words find the expected emoji first', () => {
  const search = createResultSearch(emojiResults())
  const first = (query: string) => search(query)[0]?.content
  expect(first('rocket')).toBe('🚀')
  expect(first('thumbs up')).toBe('👍')
  expect(first('fire')).toBe('🔥')
  expect(first('lol')).toBe('😂')
  expect(first('party')).toBe('🥳')
  expect(first('coffee')).toBe('☕')
  expect(first('check')).toBe('✅')
  expect(first('pizza')).toBe('🍕')
  expect(first('thanks')).toBe('🙏')
  expect(search('zzzzqx')).toEqual([])
  expect(search('heart').length).toBeGreaterThan(5)
})

test('a leading colon switches to emoji search', () => {
  expect(emojiQuery(':rocket')).toBe('rocket')
  expect(emojiQuery('  : smile ')).toBe('smile')
  expect(emojiQuery(':')).toBe('')
  expect(emojiQuery('rocket')).toBeNull()
  expect(emojiResults().every(item => item.kind === 'emoji' && item.key === `emoji:${item.content}`)).toBe(true)
})

test('your own use outranks the catalog order, and favorites lead', () => {
  const plain = createResultSearch(emojiResults())('party')
  expect(plain[0]?.content).toBe('🥳')
  const used = createResultSearch(emojiResults({ 'emoji:🎂': { launches: 2, lastUsed: 5 } }))('party')
  expect(used[0]?.content).toBe('🎂')
  const favored = createResultSearch(emojiResults({ 'emoji:🎈': { favorite: true } }))('party')
  expect(favored[0]?.content).toBe('🎈')
})
