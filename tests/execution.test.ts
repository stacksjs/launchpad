import { expect, test } from 'bun:test'
import { createExecutor } from '../resources/functions/execution'

test('the real dispatcher queues successful applications, quicklinks, GitHub links and copies before dismissing', async () => {
  const effects: string[] = []
  const execute = createExecutor({
    openApplication: async path => { effects.push(`app:${path}`) },
    openLink: async url => { effects.push(`link:${url}`) },
    copyText: async text => { effects.push(`copy:${text}`) },
    dismiss: async () => { effects.push('hidden') },
  })
  for (const kind of ['application', 'quicklink', 'github', 'snippet', 'clipboard', 'calculator']) {
    const item = { key: kind, title: 'Example', subtitle: '', kind, content: kind === 'application' ? '/Applications/Example.app' : 'https://example.com/' }
    const before = effects.length
    await execute(item, '', () => { effects.push('recorded') })
    expect(effects.slice(before)).toEqual(kind === 'application' ? ['hidden', 'app:/Applications/Example.app', 'recorded'] : [effects[before], 'recorded', 'hidden'])
  }
})

test('a stalled recording write never delays hiding after the OS accepts a launch', async () => {
  const effects: string[] = []
  let release = () => {}
  const writing = new Promise<void>((resolve) => { release = resolve })
  const execute = createExecutor({
    openApplication: async () => { effects.push('opened') },
    openLink: async () => {}, copyText: async () => {},
    dismiss: async () => { effects.push('hidden') },
  })
  const pending = execute({ key: 'mail', title: 'Mail', kind: 'application', content: '/Applications/Mail.app', subtitle: '' }, '', async () => {
    effects.push('queued')
    await writing
    effects.push('saved')
  })
  try {
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(effects).toEqual(['hidden', 'opened', 'queued'])
  }
  finally { release(); await pending }
  expect(effects).toEqual(['hidden', 'opened', 'queued', 'saved'])
})

test('recording errors cannot leave a successfully launched command covering the screen', async () => {
  let hidden = 0
  const execute = createExecutor({ openApplication: async () => {}, openLink: async () => {}, copyText: async () => {}, dismiss: async () => { hidden++ } })
  const item = { key: 'mail', title: 'Mail', kind: 'application', content: '/Applications/Mail.app', subtitle: '' }
  for (const record of [() => { throw new Error('Write failed') }, async () => { throw new Error('Write failed') }]) {
    await expect(execute(item, '', record)).rejects.toThrow('Write failed')
  }
  expect(hidden).toBe(2)
})

test('denied app and link launches are not counted, and a refused dismissal prevents handing off an application', async () => {
  let recorded = 0
  let hidden = 0
  const reject = async () => { throw new Error('Denied') }
  const failing = createExecutor({ openApplication: reject, openLink: reject, copyText: reject, dismiss: async () => { hidden++ } })
  for (const kind of ['application', 'quicklink', 'github']) {
    await expect(failing({ key: kind, title: '', subtitle: '', kind, content: 'https://example.com' }, '', () => { recorded++ })).rejects.toThrow('Denied')
  }
  expect(recorded).toBe(0)
  expect(hidden).toBe(1)
  const opened = createExecutor({ openApplication: async () => {}, openLink: async () => {}, copyText: async () => {}, dismiss: reject })
  await expect(opened({ key: 'app', title: '', subtitle: '', kind: 'application', content: '/Applications/Example.app' }, '', () => { recorded++ })).rejects.toThrow('Denied')
  expect(recorded).toBe(0)
})

test('web, file, system, window, contact, event and emoji results each take their own path', async () => {
  const effects: string[] = []
  const execute = createExecutor({
    openApplication: async path => { effects.push(`app:${path}`) },
    openLink: async url => { effects.push(`link:${url}`) },
    copyText: async text => { effects.push(`copy:${text}`) },
    dismiss: async () => { effects.push('hidden') },
    openPath: async path => { effects.push(`path:${path}`) },
    runSystem: async command => { effects.push(`system:${command.id}`) },
    focusWindow: async token => { effects.push(`window:${token}`) },
    openContact: async id => { effects.push(`contact:${id}`) },
    openEvent: async uid => { effects.push(`event:${uid}`) },
  })
  const run = (kind: string, content: string, query = '') => execute({ key: kind, title: 'T', subtitle: '', kind, content }, query)
  await run('web', 'https://duckduckgo.com/?q={query}', ' cats & dogs ')
  await run('file', '/Users/me/Notes.txt')
  await run('system', 'toggle-mute')
  await run('window', '123|2')
  await run('contact', 'ABC-123:ABPerson')
  await run('event', 'EVT-9')
  await run('emoji', '🚀')
  expect(effects.filter(effect => effect !== 'hidden')).toEqual([
    'link:https://duckduckgo.com/?q=cats%20%26%20dogs', 'path:/Users/me/Notes.txt', 'system:toggle-mute', 'window:123|2',
    'contact:ABC-123:ABPerson', 'event:EVT-9', 'copy:🚀',
  ])
})

test('forged system, contact and window results are refused before anything runs', async () => {
  const effects: string[] = []
  const execute = createExecutor({ openApplication: async () => {}, openLink: async url => { effects.push(url) }, copyText: async () => {}, dismiss: async () => { effects.push('hidden') }, runSystem: async () => { effects.push('ran') } })
  const run = (kind: string, content: string) => execute({ key: kind, title: 'T', subtitle: '', kind, content }, '')
  await expect(run('system', 'rm -rf /')).rejects.toThrow('not available')
  await expect(run('contact', 'ABC')).rejects.toThrow('not available')
  await expect(run('event', 'EVT')).rejects.toThrow('not available')
  await expect(run('window', '1|1')).rejects.toThrow('not available')
  expect(effects).toEqual([])
})

test('snippets expand placeholders, copy the result and then paste it only when a paste port exists', async () => {
  const effects: string[] = []
  const base = { openApplication: async () => {}, openLink: async () => {}, copyText: async (text: string) => { effects.push(`copy:${text}`) }, dismiss: async () => { effects.push('hidden') }, expandText: async (text: string) => text.replace('{date}', '2026-10-30') }
  const snippet = { key: 's', title: 'Sig', subtitle: '', kind: 'snippet', content: 'On {date}' }
  await createExecutor(base)(snippet, '')
  expect(effects).toEqual(['copy:On 2026-10-30', 'hidden'])
  effects.length = 0
  await createExecutor({ ...base, pasteText: async (text) => { effects.push(`paste:${text}`) } })(snippet, '')
  expect(effects).toEqual(['copy:On 2026-10-30', 'hidden', 'paste:On 2026-10-30'])
  effects.length = 0
  await createExecutor({ ...base, pasteText: async () => { throw new Error('no permission') } })(snippet, '')
  expect(effects).toEqual(['copy:On 2026-10-30', 'hidden'])
})

test('a track plays through the music port, and says so when there is none', async () => {
  const effects: string[] = []
  const base = { openApplication: async () => {}, openLink: async () => {}, copyText: async (text: string) => { effects.push(`copy:${text}`) }, dismiss: async () => { effects.push('hidden') } }
  const track = { key: 'music:track:4231', title: 'Clair de Lune', subtitle: '', kind: 'music', content: '4231' }
  await createExecutor({ ...base, playTrack: async id => { effects.push(`play:${id}`) } })(track, '')
  expect(effects).toEqual(['play:4231', 'hidden'])
  // Without the port the track must not fall through to copying its database ID to the clipboard.
  const failed = await createExecutor(base)(track, '').catch(reason => reason.message)
  expect(failed).toBe('Music is not available.')
})


test('a cold application launch hides immediately and never hides a palette reopened while waiting', async () => {
  const effects: string[] = []
  let accept!: () => void
  const opening = new Promise<void>(resolve => { accept = resolve })
  const execute = createExecutor({
    openApplication: async () => { effects.push('opening'); await opening; effects.push('accepted') },
    openLink: async () => {}, copyText: async () => {},
    dismiss: async () => { effects.push('hidden') },
  })
  const pending = execute({ key: 'cold', title: 'Cold app', kind: 'application', content: '/Applications/Cold.app', subtitle: '' }, '', () => { effects.push('recorded') }, () => { effects.push('invisible') })
  await new Promise<void>(resolve => setImmediate(resolve))
  expect(effects).toEqual(['hidden', 'invisible', 'opening'])
  effects.push('reopened')
  accept()
  await pending
  expect(effects).toEqual(['hidden', 'invisible', 'opening', 'reopened', 'accepted', 'recorded'])
})

test('an application refusal restores the palette without recording success', async () => {
  const effects: string[] = []
  const execute = createExecutor({
    openApplication: async () => { throw new Error('Application missing') },
    openLink: async () => {}, copyText: async () => {},
    dismiss: async () => { effects.push('hidden') }, restore: async () => { effects.push('restored') },
  })
  await expect(execute({ key: 'missing', title: 'Missing', kind: 'application', content: '/Applications/Missing.app', subtitle: '' }, '', () => { effects.push('recorded') })).rejects.toThrow('Application missing')
  expect(effects).toEqual(['hidden', 'restored'])
})
