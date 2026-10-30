import { expect, test } from 'bun:test'
import { applicationSearchAliases } from '../resources/functions/application-aliases'
import { normalizeSearchText, parseApplicationAliases } from '../resources/functions/search-text'
import { createResultSearch } from '../resources/functions/search'
import type { Result } from '../resources/functions/search'

function app(title: string, extra: Partial<Result> = {}, bundleId?: string): Result {
  return { key: title, title, kind: 'application', subtitle: 'Application', content: `/Applications/${title}.app`, searchAliases: applicationSearchAliases({ filename: title, displayName: title, bundleId }), ...extra }
}

test('Codex finds ChatGPT through real bundle metadata, even when renamed or localized', () => {
  const aliases = applicationSearchAliases({ filename: 'Work Assistant', displayName: '助手', bundleId: 'com.openai.codex' })
  const chatgpt = app('助手', { searchAliases: aliases })
  const search = createResultSearch([chatgpt, app('Code Xylophone', { favorite: true, launches: 999 })])
  for (const query of ['codex', 'CODEX', 'Ｃｏｄｅｘ', 'codex.app', 'chat gpt', 'openai', 'gpt', 'work assistant']) expect(search(query)[0]).toBe(chatgpt)
  expect(search('codex', 'pantry')).toEqual([])
  expect(chatgpt.title).toBe('助手')
  expect(chatgpt.content).toBe('/Applications/助手.app')
})

test('useful bundle names are extracted without indexing vendor and generic segments as aliases', () => {
  expect(applicationSearchAliases({ filename: 'Work', bundleId: 'com.acme.SuperEditor.desktop' })).toContain('SuperEditor')
  expect(applicationSearchAliases({ filename: 'Work', bundleId: 'com.microsoft.teams2' })).toContain('teams')
  expect(applicationSearchAliases({ filename: 'Work', bundleId: 'com.openai.codex.beta' })).toContain('gpt')
  expect(applicationSearchAliases({ filename: 'Work', bundleId: 'com.google.Chrome.canary' })).toContain('browser')
  expect(applicationSearchAliases({ filename: 'Work', bundleId: 'com.acme.M1' })).not.toContain('M')
  const generic = applicationSearchAliases({ filename: 'Work', bundleId: 'com.acme.desktop' })
  expect(generic).not.toContain('acme')
  expect(generic).not.toContain('com')
  expect(generic).not.toContain('desktop')
  expect(applicationSearchAliases({ filename: 'Mail Helper' })).not.toContain('email')
  expect(applicationSearchAliases({ filename: 'Codex' })).not.toContain('chatgpt')
})

test.each([
  ['System Settings', 'preferences'], ['Activity Monitor', 'task manager'], ['Mail', 'email'], ['Messages', 'imessage'],
  ['Calendar', 'ical'], ['Reminders', 'todo'], ['Music', 'itunes'], ['Photos', 'iphoto'], ['Preview', 'pdf'],
  ['Terminal', 'command line'], ['iTerm2', 'shell'], ['Visual Studio Code', 'vscode'], ['Sublime Text', 'subl'],
  ['Microsoft Teams', 'msteams'], ['Microsoft Excel', 'spreadsheet'], ['Microsoft PowerPoint', 'ppt'],
  ['GitHub Desktop', 'git client'], ['Zoom Workplace', 'zoom.us'], ['VLC', 'video player'],
  ['Adobe Photoshop 2026', 'ps'], ['Visual Studio Code - Insiders', 'code insiders'],
  ['Calculator', 'calc'], ['Maps', 'directions'], ['Books', 'ebooks'], ['Stickies', 'sticky notes'], ['Time Machine', 'backup'],
  ['Xcode', 'swift'], ['Simulator', 'ios simulator'], ['Docker Desktop', 'containers'], ['Postman', 'api client'],
])('%s is discoverable by the familiar name %s', (title, alias) => {
  const item = app(title)
  const search = createResultSearch([item])
  expect(search(alias)).toEqual([item])
  expect(search(alias + '.app')).toEqual([item])
})

test('literal app names beat aliases and shared aliases honor frequency and recency', () => {
  const chatgpt = app('ChatGPT', { launches: 1000, favorite: true })
  const codex = app('Codex')
  expect(createResultSearch([chatgpt, codex])('codex')).toEqual([codex, chatgpt])
  const browsers = [app('Safari', { launches: 30, lastUsed: 100 }), app('Firefox', { launches: 50, lastUsed: 10 }), app('Google Chrome', { launches: 50, lastUsed: 20 })]
  expect(createResultSearch(browsers)('browser').map(item => item.title)).toEqual(['Google Chrome', 'Firefox', 'Safari'])
  const mail = app('Mail', { launches: 400 })
  const maps = app('Maps', { launches: 80 })
  const music = app('Music', { launches: 100 })
  const search = createResultSearch([mail, maps, music, app('ChatGPT', { aliases: 'm', launches: 10 })])
  // An explicit exact personal alias intentionally leads prefixes; frequency
  // still orders the actual app names within their shared relevance tier.
  expect(search('m').map(item => item.title)).toEqual(['ChatGPT', 'Mail', 'Music', 'Maps'])
  expect(search('ma').map(item => item.title)).toEqual(['Mail', 'Maps'])
})

test('personal aliases normalize, stay within the app category and invalidate with the data snapshot', () => {
  expect(parseApplicationAliases('  work ai, assistant\nWORK AI; Café; cafe; ; ')).toEqual(['work ai', 'assistant', 'Café'])
  expect(normalizeSearchText('ＣＡＦÉ')).toBe('cafe')
  const item = app('ChatGPT')
  const old = createResultSearch([item])
  expect(old('work ai')).toEqual([])
  const edited = { ...item, aliases: 'work ai\ncafé' }
  const search = createResultSearch([edited])
  for (const query of ['w', 'wo', 'wor', 'work', 'work a', 'work ai', 'work a', 'work', 'wor', 'wo', 'w']) expect(search(query)).toContain(edited)
  expect(search('work ai')).toBe(search(' WORK AI '))
  expect(search('cafe')).toEqual([edited])
  expect(search('work ai', 'quicklink')).toEqual([])
  expect(old('work ai')).toEqual([])
  expect(createResultSearch([{ ...edited, aliases: '' }])('work ai')).toEqual([])
  expect(createResultSearch([{ ...edited, aliases: '' }])('codex')).toEqual([{ ...edited, aliases: '' }])
  expect(createResultSearch([{ ...edited, kind: 'snippet' }])('work ai')).toEqual([])
})

test('app identity matching accepts punctuation and accents while retaining symbol-sensitive commands', () => {
  const code = app('Visual Studio Code')
  const search = createResultSearch([code, app('Éditeur'), app('C++ Editor'), app('C# Editor')])
  for (const query of ['vscode', 'VS CODE', 'vs-code', 'VS_Code', 'VS.Code.app']) expect(search(query)[0]).toBe(code)
  expect(search('editeur')[0]?.title).toBe('Éditeur')
  expect(search('c++').map(item => item.title)).toEqual(['C++ Editor'])
  expect(search('c#').map(item => item.title)).toEqual(['C# Editor'])
  expect(search('???')).toEqual([])
  expect(search('.app')).toEqual([])
})
