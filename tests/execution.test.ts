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
    expect(effects.slice(before + 1)).toEqual(['recorded', 'hidden'])
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
    expect(effects).toEqual(['opened', 'queued', 'hidden'])
  }
  finally { release(); await pending }
  expect(effects).toEqual(['opened', 'queued', 'hidden', 'saved'])
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

test('denied app and link launches are not counted, while a later hide failure cannot erase a successful launch', async () => {
  let recorded = 0
  let hidden = 0
  const reject = async () => { throw new Error('Denied') }
  const failing = createExecutor({ openApplication: reject, openLink: reject, copyText: reject, dismiss: async () => { hidden++ } })
  for (const kind of ['application', 'quicklink', 'github']) {
    await expect(failing({ key: kind, title: '', subtitle: '', kind, content: 'https://example.com' }, '', () => { recorded++ })).rejects.toThrow('Denied')
  }
  expect(recorded).toBe(0)
  expect(hidden).toBe(0)
  const opened = createExecutor({ openApplication: async () => {}, openLink: async () => {}, copyText: async () => {}, dismiss: reject })
  await expect(opened({ key: 'app', title: '', subtitle: '', kind: 'application', content: '/Applications/Example.app' }, '', () => { recorded++ })).rejects.toThrow('Denied')
  expect(recorded).toBe(1)
})
