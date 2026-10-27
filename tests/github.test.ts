import { expect, test } from 'bun:test'
import { githubWebUrl } from '../resources/functions/github'

test('GitHub notification API links open the matching issue or pull request on GitHub', () => {
  expect(githubWebUrl('https://api.github.com/repos/stacksjs/launchpad/pulls/12', '')).toBe('https://github.com/stacksjs/launchpad/pull/12')
  expect(githubWebUrl('', 'https://github.com/stacksjs/launchpad')).toBe('https://github.com/stacksjs/launchpad')
  expect(() => githubWebUrl('https://example.com/private', '')).toThrow('unsupported destination')
  expect(() => githubWebUrl('http://github.com/stacksjs/launchpad', '')).toThrow('unsupported destination')
})
