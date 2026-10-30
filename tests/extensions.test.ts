import { expect, test } from 'bun:test'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import Extension from '../app/Models/Extension'
import { extensionResults, maxExtensionCommands, parseExtension, sampleManifest } from '../resources/functions/extensions'
import { createResultSearch, quicklinkArgument } from '../resources/functions/search'

const base = { schema: 1, name: 'Pack', version: '1.0.0', commands: [{ id: 'a', title: 'A', type: 'snippet', text: 'hello' }] }
const parse = (value: unknown) => parseExtension(JSON.stringify(value))
const errorsOf = (value: unknown) => { const result = parse(value); return result.ok ? [] : result.errors }

test('the bundled sample is a valid manifest that produces both command kinds', () => {
  const parsed = parseExtension(sampleManifest)
  expect(parsed.ok).toBe(true)
  const results = extensionResults([{ name: 'Team shortcuts', manifest: sampleManifest }])
  expect(results.map(item => item.kind)).toEqual(['quicklink', 'snippet'])
  expect(results[0]).toMatchObject({ key: 'extension:Team shortcuts:docs', alias: 'docs', content: 'https://example.com/docs?q={query}' })
  expect(results[1]!.subtitle).toBe('Team shortcuts · Copy text')
})

test('malformed input is refused with a readable reason', () => {
  expect(parseExtension('{')).toEqual({ ok: false, errors: ['The manifest is not valid JSON.'] })
  expect(parseExtension('[]')).toEqual({ ok: false, errors: ['The manifest must be a JSON object.'] })
  expect(parseExtension('null').ok).toBe(false)
  expect(parseExtension(' '.repeat(100_001)).ok).toBe(false)
  expect(errorsOf({ ...base, schema: 2 })).toContain('"schema" must be 1.')
  expect(errorsOf({ ...base, name: '' })).toContain('"name" must be 1 to 60 characters.')
  expect(errorsOf({ ...base, version: 'x'.repeat(21) })).toContain('"version" must be 1 to 20 characters.')
  expect(errorsOf({ ...base, commands: [] })).toContain('"commands" must list at least one command.')
  expect(errorsOf({ ...base, commands: Array.from({ length: maxExtensionCommands + 1 }, (_, i) => ({ id: `c${i}`, title: 'T', type: 'snippet', text: 'x' })) })[0]).toContain('at most 100')
})

test('unknown fields, scripts and executable address schemes are rejected', () => {
  expect(errorsOf({ ...base, run: 'rm -rf /' })).toContain('Unknown field "run".')
  expect(errorsOf({ ...base, commands: [{ id: 'a', title: 'A', type: 'snippet', text: 'x', script: 'do shell script "x"' }] })).toContain('Command 1: unknown field "script".')
  expect(errorsOf({ ...base, commands: [{ id: 'a', title: 'A', type: 'shell', text: 'ls' }] })).toContain('Command 1: "type" must be "quicklink" or "snippet".')
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'example.com', 'ftp://example.com', '', 'x'.repeat(2001)])
    expect(errorsOf({ ...base, commands: [{ id: 'a', title: 'A', type: 'quicklink', url }] })).toContain('Command 1: "url" must be an http or https address.')
  expect(errorsOf({ ...base, commands: [{ id: 'a', title: 'A', type: 'quicklink', url: 'https://example.com/{query}', text: 'x' }] })).toContain('Command 1: a quicklink cannot have "text".')
  expect(errorsOf({ ...base, commands: [{ id: 'a', title: 'A', type: 'snippet', text: 'x', url: 'https://example.com' }] })).toContain('Command 1: a snippet cannot have "url".')
})

test('ids must be unique, simple and present', () => {
  const command = (id: unknown) => ({ id, title: 'T', type: 'snippet', text: 'x' })
  expect(errorsOf({ ...base, commands: [command('a'), command('a')] })).toContain('Command 2: the id "a" is used twice.')
  for (const id of ['', 'A', 'has space', '-lead', 'x'.repeat(41), 5, null, '../x'])
    expect(errorsOf({ ...base, commands: [command(id)] }).some(message => message.includes('"id"'))).toBe(true)
  expect(parse({ ...base, commands: [command('ok-1')] }).ok).toBe(true)
})

test('only the first problems are reported, so a huge bad file cannot flood the screen', () => {
  expect(errorsOf({ ...base, commands: Array.from({ length: 50 }, () => ({ nope: 1 })) }).length).toBeLessThanOrEqual(8)
})

test('disabled and damaged extensions contribute nothing and never block valid ones', () => {
  const good = JSON.stringify({ ...base, name: 'Good' })
  const results = extensionResults([{ name: 'Off', manifest: good, enabled: false }, { name: 'Broken', manifest: '{' }, { name: 'Good', manifest: good, enabled: true }, { name: 'Default', manifest: JSON.stringify({ ...base, name: 'Default' }) }])
  expect(results.map(item => item.key)).toEqual(['extension:Good:a', 'extension:Default:a'])
})

test('extension quicklinks keep their alias workflow', () => {
  const [docs] = extensionResults([{ name: 'Team shortcuts', manifest: sampleManifest }])
  expect(quicklinkArgument(docs!, 'docs onboarding guide')).toBe('onboarding guide')
  expect(createResultSearch([docs!])('docs onboarding')[0]).toBe(docs)
})

test('the extension model stores, replaces and removes manifests', async () => {
  const models = { Extension }
  const database = openNativeDatabase({ path: ':memory:', models })
  try {
    const api = createNativeModelApi({ models, authorize: () => true })
    const send = (method: string, path: string, body?: object) => api(new Request(`http://localhost/api/${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }))
    const created = await send('POST', 'extensions', { name: 'Pack', manifest: sampleManifest, enabled: true })
    expect(created?.status).toBe(201)
    const { data } = await created!.json()
    expect((await send('POST', 'extensions', { name: 'Pack', manifest: sampleManifest }))?.status).not.toBe(201)
    expect((await send('PATCH', `extensions/${data.id}`, { enabled: false }))?.status).toBe(200)
    expect((await Extension.find(data.id))?.enabled).toBeFalsy()
    expect((await send('POST', 'extensions', { name: 'Huge', manifest: 'x'.repeat(100_001) }))?.status).toBe(422)
    expect((await send('DELETE', `extensions/${data.id}`))?.status).toBeLessThan(300)
    expect(await Extension.count()).toBe(0)
  }
  finally { database.close() }
})
