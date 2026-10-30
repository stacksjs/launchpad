import { normalizeSearchText } from './search-text'

interface AliasRule {
  names: string
  ids?: string
  aliases: string
}

// Exact identities only: a name such as "Mail Helper" must not inherit Mail's aliases.
// These are alternative app names and useful launch intents, never query rewrites.
const rules: readonly AliasRule[] = [
  { names: 'ChatGPT|Chat GPT', ids: 'com.openai.chat|com.openai.codex', aliases: 'chatgpt|chat gpt|codex|openai|gpt|ai assistant' },
  { names: 'System Settings|System Preferences', ids: 'com.apple.systempreferences', aliases: 'settings|preferences|system preferences|control panel' },
  { names: 'Activity Monitor', ids: 'com.apple.ActivityMonitor', aliases: 'task manager|processes|cpu|memory' },
  { names: 'Terminal', ids: 'com.apple.Terminal', aliases: 'command line|command prompt|shell|console|cli' },
  { names: 'iTerm|iTerm2', ids: 'com.googlecode.iterm2', aliases: 'iterm|iterm2|terminal|shell|console|command line' },
  { names: 'Ghostty', aliases: 'terminal|shell|command line' },
  { names: 'Warp', aliases: 'terminal|shell|command line' },
  { names: 'Finder', ids: 'com.apple.finder', aliases: 'files|file manager' },
  { names: 'Disk Utility', ids: 'com.apple.DiskUtility', aliases: 'disks|disk manager|storage' },
  { names: 'App Store', ids: 'com.apple.AppStore', aliases: 'appstore|mac app store|software store' },
  { names: 'Mail', ids: 'com.apple.mail', aliases: 'email|e-mail|apple mail' },
  { names: 'Messages', ids: 'com.apple.MobileSMS', aliases: 'imessage|text messages|sms' },
  { names: 'Calendar', ids: 'com.apple.iCal', aliases: 'ical|schedule|appointments' },
  { names: 'Reminders', ids: 'com.apple.reminders', aliases: 'todo|to do|tasks|task list' },
  { names: 'Notes', ids: 'com.apple.Notes', aliases: 'apple notes|notepad|notebook' },
  { names: 'TextEdit', ids: 'com.apple.TextEdit', aliases: 'text edit|text editor|notepad|plain text' },
  { names: 'Music', ids: 'com.apple.Music', aliases: 'itunes|apple music|music player' },
  { names: 'TV', ids: 'com.apple.TV', aliases: 'apple tv|movies' },
  { names: 'Photos', ids: 'com.apple.Photos', aliases: 'iphoto|pictures|photo library' },
  { names: 'Preview', ids: 'com.apple.Preview', aliases: 'pdf|pdf viewer|image viewer' },
  { names: 'FaceTime', ids: 'com.apple.FaceTime', aliases: 'face time|video call' },
  { names: 'Screenshot', aliases: 'screen capture|screengrab|screen shot' },
  { names: 'Dictionary', ids: 'com.apple.Dictionary', aliases: 'thesaurus|define|definitions' },
  { names: 'Passwords|1Password|Bitwarden', aliases: 'password manager|passwords' },
  { names: 'Keychain Access', ids: 'com.apple.keychainaccess', aliases: 'keychain|credentials|certificates' },
  { names: 'Google Chrome|Chrome', ids: 'com.google.Chrome', aliases: 'chrome|google chrome|web browser|browser' },
  { names: 'Google Chrome Canary|Chrome Canary', aliases: 'chrome canary|chrome|web browser|browser' },
  { names: 'Safari|Firefox|Microsoft Edge|Brave Browser|Arc', aliases: 'web browser|browser|internet' },
  { names: 'Firefox', aliases: 'mozilla|mozilla firefox' },
  { names: 'Microsoft Edge', aliases: 'edge|ms edge' },
  { names: 'Brave Browser', aliases: 'brave' },
  { names: 'Visual Studio Code', ids: 'com.microsoft.VSCode', aliases: 'vscode|vs code|code|code editor|text editor' },
  { names: 'Visual Studio Code - Insiders', aliases: 'vscode insiders|vs code insiders|code insiders|vscode|code editor' },
  { names: 'Zed', aliases: 'zed editor|code editor|text editor' },
  { names: 'Sublime Text', aliases: 'sublime|subl|sublimetext|code editor|text editor' },
  { names: 'BBEdit', aliases: 'textwrangler|text editor' },
  { names: 'IntelliJ IDEA|IntelliJ IDEA CE|IntelliJ IDEA Ultimate', aliases: 'idea|intellij|intellij idea|java ide' },
  { names: 'PyCharm|PyCharm CE', aliases: 'pycharm|python ide' },
  { names: 'WebStorm', aliases: 'webstorm|javascript ide' },
  { names: 'GitHub Desktop', aliases: 'github|gh desktop|git client' },
  { names: 'Microsoft Word', aliases: 'word|ms word|msword|document editor' },
  { names: 'Microsoft Excel', aliases: 'excel|ms excel|spreadsheet' },
  { names: 'Microsoft PowerPoint', aliases: 'powerpoint|power point|ppt|slides|presentation' },
  { names: 'Microsoft Outlook', aliases: 'outlook|email|e-mail|calendar' },
  { names: 'Microsoft Teams|Microsoft Teams classic', aliases: 'teams|ms teams|msteams' },
  { names: 'Microsoft OneNote', aliases: 'onenote|one note|notes|notebook' },
  { names: 'Slack|Discord', aliases: 'team chat|chat' },
  { names: 'Notion|Obsidian', aliases: 'notes|notebook|knowledge base' },
  { names: 'Obsidian', aliases: 'markdown|markdown editor' },
  { names: 'Things|Things3|Todoist', aliases: 'todo|to do|tasks|task manager' },
  { names: 'Fantastical', aliases: 'calendar|schedule' },
  { names: 'zoom.us|Zoom|Zoom Workplace', aliases: 'zoom|zoom.us|meetings|video call|video conference' },
  { names: 'Figma|Sketch', aliases: 'design|ui design' },
  { names: 'Adobe Photoshop', aliases: 'photoshop|ps|image editor|photo editor' },
  { names: 'Adobe Illustrator', aliases: 'illustrator|vector editor' },
  { names: 'Adobe Lightroom|Adobe Lightroom Classic', aliases: 'lightroom|photo editor' },
  { names: 'VLC|IINA', aliases: 'video player|media player' },
  { names: 'Spotify', aliases: 'music|music player' },
  { names: 'Google Drive|Dropbox', aliases: 'file sync|cloud storage' },
  { names: 'Calculator', ids: 'com.apple.calculator', aliases: 'calc|math|arithmetic' },
  { names: 'Maps', ids: 'com.apple.Maps', aliases: 'apple maps|directions|navigation' },
  { names: 'Podcasts', ids: 'com.apple.podcasts', aliases: 'podcast|audio shows' },
  { names: 'Books', ids: 'com.apple.iBooksX', aliases: 'ibooks|ebooks|reader' },
  { names: 'Stickies', ids: 'com.apple.Stickies', aliases: 'sticky notes|post it' },
  { names: 'Time Machine', ids: 'com.apple.backup.launcher', aliases: 'backup|restore' },
  { names: 'Xcode', ids: 'com.apple.dt.Xcode', aliases: 'ios development|swift|apple ide' },
  { names: 'Simulator', ids: 'com.apple.iphonesimulator', aliases: 'ios simulator|iphone simulator' },
  { names: 'Docker|Docker Desktop', ids: 'com.docker.docker', aliases: 'containers|docker desktop' },
  { names: 'Postman|Insomnia', aliases: 'api client|http client|rest client' },
]

const identity = (value: string) => normalizeSearchText(value).replace(/\.app$/u, '').replace(/[^\p{L}\p{N}+#]/gu, '')
const byName = new Map<string, string[]>()
const byId = new Map<string, string[]>()
for (const rule of rules) {
  const aliases = rule.aliases.split('|')
  for (const name of rule.names.split('|')) byName.set(identity(name), [...(byName.get(identity(name)) ?? []), ...aliases])
  for (const id of rule.ids?.split('|') ?? []) byId.set(id.toLowerCase(), aliases)
}
const genericBundleParts = new Set(['app', 'application', 'desktop', 'mac', 'macos', 'client', 'launcher', 'helper', 'electron', 'stable', 'beta', 'canary', 'nightly', 'insiders', 'dev', 'debug', 'release'])

/** Called only while indexing an installed application, never on a keystroke. */
export function applicationSearchAliases(info: { filename: string, displayName?: string, bundleName?: string, bundleId?: string }): string[] {
  const names = [info.filename, info.bundleName, info.displayName].filter((name): name is string => Boolean(name))
  const aliases = [...names, ...(info.bundleId ? [info.bundleId] : [])]
  const parts = info.bundleId?.split('.') ?? []
  let known = info.bundleId ? byId.get(info.bundleId.toLowerCase()) : undefined
  for (let length = parts.length; !known && length > 3; length--) {
    const suffix = parts[length - 1]!.toLowerCase()
    if (!genericBundleParts.has(suffix) && !/^\d+$/.test(suffix)) break
    known = byId.get(parts.slice(0, length - 1).join('.').toLowerCase())
  }
  aliases.push(...(known || names.flatMap((name) => {
    const base = name.replace(/\.app$/iu, '')
      .replace(/[\s-]{1,16}\(?\d{1,4}(?:\.\d{1,4}){0,3}\)?$/u, '')
      .replace(/[\s-]{1,16}(?:beta|canary|nightly|insiders)$/iu, '')
    return [...(byName.get(identity(name)) ?? []), ...(base !== name ? byName.get(identity(base)) ?? [] : [])]
  })))
  // A renamed/localized app can retain its original product name in its bundle
  // identifier, e.g. ChatGPT's com.openai.codex. Ignore vendor/generic segments.
  for (let index = parts.length - 1; index >= 2; index--) {
    const part = parts[index]!
    if (genericBundleParts.has(part.toLowerCase()) || /^\d+$/.test(part)) continue
    if (/\p{L}/u.test(part)) {
      aliases.push(part)
      const versionless = part.replace(/(?<=\p{L})\d+$/u, '')
      if (versionless.length >= 3) aliases.push(versionless)
    }
    break
  }
  const seen = new Set<string>([normalizeSearchText(info.displayName || info.filename)])
  return aliases.flatMap((value) => {
    const alias = value.trim()
    const key = normalizeSearchText(alias)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [alias]
  })
}
