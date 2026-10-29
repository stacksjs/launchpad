import { expect, test } from 'bun:test'
import { githubResults, githubWebUrl } from '../resources/functions/github'

test('GitHub notification API links open the matching issue or pull request on GitHub', () => {
  expect(githubWebUrl('https://api.github.com/repos/stacksjs/launchpad/pulls/12', '')).toBe('https://github.com/stacksjs/launchpad/pull/12')
  expect(githubWebUrl('', 'https://github.com/stacksjs/launchpad')).toBe('https://github.com/stacksjs/launchpad')
  expect(() => githubWebUrl('https://example.com/private', '')).toThrow('unsupported destination')
  expect(() => githubWebUrl('http://github.com/stacksjs/launchpad', '')).toThrow('unsupported destination')
})

test('superseded GitHub searches cancel the underlying HTTP request', async () => {
  const fetcher = globalThis.fetch
  const controller = new AbortController()
  let received: AbortSignal | undefined
  let started: () => void = () => {}
  const requested = new Promise<void>((resolve) => { started = resolve })
  globalThis.fetch = (async (_input, init) => {
    received = init?.signal as AbortSignal
    started()
    return await new Promise<Response>((_resolve, reject) => {
      if (received!.aborted) { reject(received!.reason); return }
      received!.addEventListener('abort', () => reject(received!.reason), { once: true })
    })
  }) as typeof fetch
  try {
    const pending = githubResults('repositories', 'launchpad', '', '', controller.signal)
    const failure = pending.catch(error => error)
    await requested
    controller.abort()
    expect((await failure).name).toBe('AbortError')
    expect(received?.aborted).toBe(true)
  }
  finally { globalThis.fetch = fetcher }
})
