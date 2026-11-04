import { expect, test } from 'bun:test'
import {
  categoryLabel, maxVaultItems, parseVaultItems, vaultListArguments,
  vaultOpenUrl, vaultResults,
} from '../resources/functions/passwords'

const id = 'abcdefghijklmnopqrstuvwxyz'
const other = '234567abcdefghijklmnopqrs'
const entry = (overrides: Record<string, unknown> = {}) => ({
  id, title: 'Example Login', category: 'LOGIN',
  vault: { id: 'v', name: 'Private' },
  urls: [{ primary: true, href: 'https://example.com/' }],
  ...overrides,
})

test('the only command it runs is the one that cannot return a secret', () => {
  expect(vaultListArguments).toEqual(['item', 'list', '--format', 'json', '--cache'])
  // `item get`, `read` and `document` all return field contents. None of them is reachable from here.
  for (const forbidden of ['get', 'read', 'document', 'signin']) expect(vaultListArguments).not.toContain(forbidden)
})

test('a listing is read into titles and identifiers, and nothing else', () => {
  const [item] = parseVaultItems(JSON.stringify([entry()]))
  expect(item).toEqual({ id, title: 'Example Login', category: 'LOGIN', vault: 'Private', url: 'https://example.com/' })
  // Anything else the CLI sends along is simply not taken.
  const extra = parseVaultItems(JSON.stringify([entry({ password: 'hunter2', fields: [{ value: 'secret' }] })]))
  expect(Object.keys(extra[0]!).sort()).toEqual(['category', 'id', 'title', 'url', 'vault'])
  expect(JSON.stringify(extra)).not.toContain('hunter2')
})

test('damaged or hostile output is nothing, never a throw', () => {
  for (const bad of ['', 'not json', '{}', 'null', '[1, 2]', '["x"]']) expect(parseVaultItems(bad)).toEqual([])
  // An entry that could not be shown or opened is dropped rather than half-rendered.
  expect(parseVaultItems(JSON.stringify([entry({ id: 'short' }), entry({ title: '' }), entry({ id: undefined })]))).toEqual([])
})

test('a stored address is kept only when a browser could open it', () => {
  const site = (href: unknown) => parseVaultItems(JSON.stringify([entry({ urls: [{ primary: true, href }] })]))[0]!.url
  expect(site('https://example.com/in')).toBe('https://example.com/in')
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,x', 'onepassword://x', 42, null]) expect(site(bad)).toBe('')
  // With no primary marked, the first address is the one worth keeping.
  expect(parseVaultItems(JSON.stringify([entry({ urls: [{ href: 'https://first.example/' }, { href: 'https://second.example/' }] })]))[0]!.url).toBe('https://first.example/')
  expect(parseVaultItems(JSON.stringify([entry({ urls: undefined })]))[0]!.url).toBe('')
})

test('a listing is bounded, because a vault can hold more than anyone reads', () => {
  const many = Array.from({ length: maxVaultItems + 25 }, (_, index) => entry({ title: `Item ${index}` }))
  expect(parseVaultItems(JSON.stringify(many))).toHaveLength(maxVaultItems)
})

test('a row names the vault and the kind, never a field of the item', () => {
  const [row] = vaultResults(parseVaultItems(JSON.stringify([entry()])))
  expect(row).toMatchObject({ title: 'Example Login', subtitle: '1Password · Login · Private', kind: 'password', content: id })
  // The site is searchable because it is not a secret; nothing else from the item is carried.
  expect(row!.searchText).toBe('https://example.com/')
  expect(categoryLabel('SECURE_NOTE')).toBe('Secure note')
  expect(categoryLabel('')).toBe('Item')
})

test('only an identifier 1Password issued ever becomes a link', () => {
  expect(vaultOpenUrl(id)).toBe(`onepassword://view-item?id=${id}`)
  expect(vaultOpenUrl(other.toUpperCase() + 'T')).toBe(`onepassword://view-item?id=${other.toUpperCase()}T`)
  for (const bad of ['', 'short', `${id}extra`, `${id}/../x`, 'javascript:alert(1)', '../../etc']) expect(vaultOpenUrl(bad)).toBeNull()
})
