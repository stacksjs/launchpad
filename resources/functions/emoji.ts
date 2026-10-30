import { emojiData } from './emoji-data'
import type { Result } from './search'

interface UsageRecord { favorite?: boolean, launches?: number, lastUsed?: number }

/**
 * Emoji results are copy-only rows. Titles lead with the character so it is the first thing you see.
 * Your own use ranks first; ties follow the catalog, where common emoji come first.
 */
export function emojiResults(records: Record<string, UsageRecord | undefined> = {}): Result[] {
  return emojiData.map(([character, name, keywords], index) => {
    const key = `emoji:${character}`
    const record = records[key]
    return {
      key, title: `${character}  ${name}`, subtitle: 'Emoji · Copy', kind: 'emoji', content: character,
      alias: name, searchAliases: keywords.split(' '),
      favorite: Boolean(record?.favorite), lastUsed: record?.lastUsed ?? 0, launches: (record?.launches ?? 0) * 10_000 + (emojiData.length - index),
    }
  })
}

/** `:rocket` searches only emoji. Returns the text after the colon, or null when the query is not an emoji search. */
export function emojiQuery(input: string): string | null {
  const text = input.trimStart()
  return text.startsWith(':') ? text.slice(1).trim() : null
}
