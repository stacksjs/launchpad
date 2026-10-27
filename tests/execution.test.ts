import { expect, test } from 'bun:test'
import { createExecutor } from '../resources/functions/execution'

test('the real dispatcher records successful applications, quicklinks, GitHub links and copies before dismissing', async () => {
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

test('denied app and link launches are not counted, while a later hide failure cannot erase a successful launch', async () => {
  let recorded = 0
  const reject = async () => { throw new Error('Denied') }
  const failing = createExecutor({ openApplication: reject, openLink: reject, copyText: reject, dismiss: async () => {} })
  for (const kind of ['application', 'quicklink', 'github']) {
    await expect(failing({ key: kind, title: '', subtitle: '', kind, content: 'https://example.com' }, '', () => { recorded++ })).rejects.toThrow('Denied')
  }
  expect(recorded).toBe(0)
  const opened = createExecutor({ openApplication: async () => {}, openLink: async () => {}, copyText: async () => {}, dismiss: reject })
  await expect(opened({ key: 'app', title: '', subtitle: '', kind: 'application', content: '/Applications/Example.app' }, '', () => { recorded++ })).rejects.toThrow('Denied')
  expect(recorded).toBe(1)
})
