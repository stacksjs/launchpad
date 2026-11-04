import type { Result } from './search'

/**
 * Finding a saved login without switching to the password manager and searching again.
 *
 * The boundary is the point of this file. Launchpad asks the 1Password CLI for a list of item titles and identifiers,
 * and nothing else. It never runs `op item get`, never reads a field, never holds a vault credential, and never keeps
 * what it was told. Choosing a result hands the identifier back to 1Password, which decides what to reveal and asks
 * for whatever it needs first.
 *
 * Everything here is pure: the command to run, the shape of its answer, and the link that opens an item.
 */
export interface VaultItem { id: string, title: string, category: string, vault: string, url: string }

/** A listing longer than this is not read; a query narrows it instead. */
export const maxVaultItems = 50

/**
 * The only command this feature ever runs. `item list` returns titles and identifiers; the commands that return a
 * secret are deliberately not reachable from here.
 */
export const vaultListArguments: readonly string[] = ['item', 'list', '--format', 'json', '--cache']

/** 1Password identifiers are 26 character base32. Anything else never reaches a link. */
const validId = (id: string) => /^[a-z0-9]{26}$/i.test(id)

/** Only what a browser could open, so an item's stored address can never carry a scheme of its own. */
function siteUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : ''
  }
  catch { return '' }
}

const text = (value: unknown, limit = 200) => typeof value === 'string' ? value.trim().slice(0, limit) : ''

/**
 * Reads what `op item list` returned. Only four fields are taken, and an entry without an identifier and a title is
 * dropped: it could neither be shown nor opened.
 */
export function parseVaultItems(output: string): VaultItem[] {
  let parsed: unknown
  try { parsed = JSON.parse(output) }
  catch { return [] }
  if (!Array.isArray(parsed)) return []
  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const row = entry as Record<string, unknown>
    const id = text(row.id, 40)
    const title = text(row.title)
    if (!validId(id) || !title) return []
    const vault = row.vault && typeof row.vault === 'object' ? text((row.vault as Record<string, unknown>).name, 60) : ''
    const urls = Array.isArray(row.urls) ? row.urls as Record<string, unknown>[] : []
    const primary = urls.find(item => item?.primary === true) ?? urls[0]
    return [{ id, title, category: text(row.category, 40), vault, url: siteUrl(primary?.href) }]
  }).slice(0, maxVaultItems)
}

/** A category as it reads in a subtitle. 1Password spells them in upper snake case. */
export function categoryLabel(category: string): string {
  const words = category.replace(/_/g, ' ').trim().toLocaleLowerCase()
  if (!words) return 'Item'
  return words.charAt(0).toLocaleUpperCase() + words.slice(1)
}

/**
 * Rows for the palette. The subtitle names the vault and the kind of item, never a field of it, so nothing secret is
 * on screen even for a moment.
 */
export function vaultResults(items: readonly VaultItem[]): Result[] {
  return items.slice(0, maxVaultItems).map(item => ({
    key: `password:${item.id}`,
    title: item.title,
    subtitle: ['1Password', categoryLabel(item.category), item.vault].filter(Boolean).join(' · '),
    kind: 'password',
    content: item.id,
    // The site the login belongs to is worth searching for, and is not a secret.
    searchText: item.url,
  }))
}

/** The link that hands an item back to 1Password. Null for anything that is not an identifier it issued. */
export function vaultOpenUrl(id: string): string | null {
  return validId(id) ? `onepassword://view-item?id=${encodeURIComponent(id)}` : null
}
