import { quicklinkUrl } from './search'
import type { Result } from './search'

/**
 * Extensions are declarative data, not code. A manifest can add quicklinks and snippets and nothing else:
 * no scripts, no network access, no file access. That keeps installing one as safe as pasting text.
 */
export interface ExtensionCommand {
  id: string
  title: string
  type: 'quicklink' | 'snippet'
  /** Quicklink address template. {query} is replaced with what follows the alias. */
  url?: string
  /** Snippet text. Placeholders such as {date} are filled in when it is used. */
  text?: string
  alias?: string
  subtitle?: string
}
export interface ExtensionManifest { schema: 1, name: string, version: string, description?: string, commands: ExtensionCommand[] }

export const maxManifestLength = 100_000
export const maxExtensionCommands = 100
const idPattern = /^[a-z0-9][a-z0-9-]{0,39}$/
const rootKeys = new Set(['schema', 'name', 'version', 'description', 'commands'])
const commandKeys = new Set(['id', 'title', 'type', 'url', 'text', 'alias', 'subtitle'])

export type ParsedExtension = { ok: true, manifest: ExtensionManifest } | { ok: false, errors: string[] }

function isHttpAddress(value: string): boolean {
  try {
    quicklinkUrl(value, '')
    return true
  }
  catch { return false }
}
const isText = (value: unknown, min: number, max: number): value is string => typeof value === 'string' && value.trim().length >= min && value.length <= max

/** Strict validation: unknown fields, wrong types and unsafe addresses are all refused with a readable reason. */
export function parseExtension(source: string): ParsedExtension {
  if (source.length > maxManifestLength) return { ok: false, errors: [`The manifest is larger than ${maxManifestLength.toLocaleString('en-US')} characters.`] }
  let data: unknown
  try { data = JSON.parse(source) }
  catch { return { ok: false, errors: ['The manifest is not valid JSON.'] } }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, errors: ['The manifest must be a JSON object.'] }
  const errors: string[] = []
  const root = data as Record<string, unknown>
  for (const key of Object.keys(root)) if (!rootKeys.has(key)) errors.push(`Unknown field "${key}".`)
  if (root.schema !== 1) errors.push('"schema" must be 1.')
  if (!isText(root.name, 1, 60)) errors.push('"name" must be 1 to 60 characters.')
  if (!isText(root.version, 1, 20)) errors.push('"version" must be 1 to 20 characters.')
  if (root.description !== undefined && !isText(root.description, 0, 200)) errors.push('"description" must be at most 200 characters.')
  const commands: ExtensionCommand[] = []
  if (!Array.isArray(root.commands) || !root.commands.length) errors.push('"commands" must list at least one command.')
  else if (root.commands.length > maxExtensionCommands) errors.push(`"commands" can list at most ${maxExtensionCommands} commands.`)
  else {
    const seen = new Set<string>()
    root.commands.forEach((entry: unknown, index: number) => {
      const label = `Command ${index + 1}`
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push(`${label} must be an object.`)
        return
      }
      const command = entry as Record<string, unknown>
      for (const key of Object.keys(command)) if (!commandKeys.has(key)) errors.push(`${label}: unknown field "${key}".`)
      if (typeof command.id !== 'string' || !idPattern.test(command.id)) errors.push(`${label}: "id" must be lowercase letters, numbers and dashes, up to 40 characters.`)
      else if (seen.has(command.id)) errors.push(`${label}: the id "${command.id}" is used twice.`)
      else seen.add(command.id)
      if (!isText(command.title, 1, 120)) errors.push(`${label}: "title" must be 1 to 120 characters.`)
      if (command.type === 'quicklink') {
        if (command.text !== undefined) errors.push(`${label}: a quicklink cannot have "text".`)
        if (typeof command.url !== 'string' || command.url.length > 2000) errors.push(`${label}: "url" must be an http or https address.`)
        else if (!isHttpAddress(command.url)) errors.push(`${label}: "url" must be an http or https address.`)
      }
      else if (command.type === 'snippet') {
        if (command.url !== undefined) errors.push(`${label}: a snippet cannot have "url".`)
        if (!isText(command.text, 1, 20000)) errors.push(`${label}: "text" must be 1 to 20,000 characters.`)
      }
      else errors.push(`${label}: "type" must be "quicklink" or "snippet".`)
      if (command.alias !== undefined && !isText(command.alias, 1, 40)) errors.push(`${label}: "alias" must be 1 to 40 characters.`)
      if (command.subtitle !== undefined && !isText(command.subtitle, 0, 120)) errors.push(`${label}: "subtitle" must be at most 120 characters.`)
      commands.push(command as unknown as ExtensionCommand)
    })
  }
  if (errors.length) return { ok: false, errors: errors.slice(0, 8) }
  return { ok: true, manifest: { schema: 1, name: (root.name as string).trim(), version: (root.version as string).trim(), description: root.description as string | undefined, commands } }
}

export interface InstalledExtension { name: string, manifest: string, enabled?: boolean }

/** Results from every enabled, valid extension. A damaged manifest contributes nothing and never blocks the others. */
export function extensionResults(installed: readonly InstalledExtension[]): Result[] {
  return installed.flatMap((row) => {
    if (row.enabled === false) return []
    const parsed = parseExtension(row.manifest)
    if (!parsed.ok) return []
    return parsed.manifest.commands.map((command): Result => ({
      key: `extension:${parsed.manifest.name}:${command.id}`, title: command.title,
      subtitle: command.subtitle || `${parsed.manifest.name} · ${command.type === 'snippet' ? 'Copy text' : 'Open link'}`,
      kind: command.type, content: command.type === 'snippet' ? command.text! : command.url!, alias: command.alias,
    }))
  })
}

/** A starting point people can edit. It installs as-is. */
export const sampleManifest: string = JSON.stringify({
  schema: 1, name: 'Team shortcuts', version: '1.0.0', description: 'Links and text for my team.',
  commands: [
    { id: 'docs', title: 'Search team docs', type: 'quicklink', url: 'https://example.com/docs?q={query}', alias: 'docs' },
    { id: 'standup', title: 'Standup note', type: 'snippet', text: 'Standup {date}\nYesterday: \nToday: \nBlocked: ' },
  ],
}, null, 2)
