import { conversionResult } from './convert'
import type { RatesState } from './convert'
import { emojiQuery } from './emoji'
import { idleVisible } from './result-list'
import { createResultSearch } from './search'
import type { Result } from './search'
import type { SearchSettings } from './search-settings'
import { webSearchResult } from './web-search'

type Search = (input: string, category?: string) => Result[]

export interface ComposeInputs {
  category: string
  query: string
  /** Applications, saved commands, clipboard, installed packages, system commands and extension commands. */
  searchLocal: Search
  /** Emoji search, already weighted by the person's own use. */
  searchEmoji: Search
  files: readonly Result[]
  windows: readonly Result[]
  contacts: readonly Result[]
  events: readonly Result[]
  rates: RatesState
  settings: SearchSettings
  calculate: (input: string) => string | null
}

/** How many file matches ride along at the end of an ordinary search. The Files tab shows them all. */
export const inlineFiles = 5

const calculatorRow = (answer: string): Result => ({ key: 'calculator', title: answer, subtitle: 'Calculator · Copy result', kind: 'calculator', content: answer })

/** Everything the result list can show, for the active tab and query. Pure, so the whole pipeline is testable. */
export function composeResults(input: ComposeInputs): Result[] {
  const { category, query } = input
  const text = query.trim()
  if (category === 'emoji') return input.searchEmoji(query, 'emoji')
  if (category === 'file') return text ? [...input.files] : []
  if (category === 'contact') return text.length >= 2 ? [...input.contacts] : []
  if (category === 'window') return text ? createResultSearch([...input.windows])(query) : [...input.windows]
  if (category === 'event') return text ? createResultSearch([...input.events])(query) : [...input.events]
  if (category !== 'all') return input.searchLocal(query, category)

  const emoji = emojiQuery(query)
  if (emoji !== null) return input.searchEmoji(emoji, 'emoji')

  const found = input.searchLocal(query, 'all')
  if (!text) return found.filter(idleVisible)

  const answer = input.calculate(query)
  const conversion = answer === null ? conversionResult(query, input.rates) : null
  const lead = answer !== null ? [calculatorRow(answer)] : conversion ? [conversion] : []
  const files = input.settings.files && text.length >= 2 ? input.files.slice(0, inlineFiles) : []
  const web = webSearchResult(query, input.settings.web)
  return [...lead, ...found, ...files, ...(web ? [web] : [])]
}

/** Only things with a stable identity earn favorites and launch counts. Paths, people, windows and events do not. */
export function isRankable(kind: string): boolean {
  return !['calculator', 'file', 'window', 'contact', 'event', 'web', 'setup', 'pantry'].includes(kind)
}

export function actionLabelFor(kind: string | undefined): string {
  if (kind === 'pantry') return 'Details'
  if (kind === 'system') return 'Run'
  if (kind === 'setup') return 'Settings'
  if (kind === 'window') return 'Switch'
  if (kind && ['application', 'quicklink', 'github', 'web', 'file', 'contact', 'event'].includes(kind)) return 'Open'
  return 'Copy'
}

export interface SecondaryAction { reveal: boolean, copy: string }

/** Command Return reveals a file in Finder; Shift Command C copies its path, email address or phone number. */
export function secondaryActions(item: Pick<Result, 'kind' | 'content' | 'detail'> | undefined): SecondaryAction {
  return { reveal: item?.kind === 'file', copy: item?.kind === 'file' ? item.content : item?.kind === 'contact' ? item.detail ?? '' : '' }
}
