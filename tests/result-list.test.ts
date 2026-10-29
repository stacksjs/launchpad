import { expect, test } from 'bun:test'
import { createResultPresentation, resultWindow } from '../resources/functions/result-list'

test('result windows bound DOM rows and retain the scroll height and absolute positions', () => {
  expect(resultWindow(100, 0, 260)).toEqual({ start: 0, end: 7, top: 0, bottom: 4836 })
  expect(resultWindow(100, 520, 260)).toEqual({ start: 8, end: 17, top: 416, bottom: 4316 })
  expect(resultWindow(100, 4940, 260)).toEqual({ start: 93, end: 100, top: 4836, bottom: 0 })
  expect(resultWindow(0, 0, 260)).toEqual({ start: 0, end: 0, top: 0, bottom: 0 })
  expect(resultWindow(100, -200, 260)).toEqual(resultWindow(100, 0, 260))
  const window = resultWindow(10000, 52000, 260)
  expect(window.end - window.start).toBe(9)
  expect(window.top + (window.end - window.start) * 52 + window.bottom).toBe(520000)
})

test('presentation preserves unchanged row identities across queries and unrelated icon updates', () => {
  const app = { key: 'app', title: 'Mail', subtitle: 'Application', kind: 'application', content: '/Mail.app' }
  const present = createResultPresentation()
  expect(present([app], {})[0]).toBe(app)
  const icon = present([app], { '/Mail.app': 'data:mail' })[0]!
  expect(present([app], { '/Mail.app': 'data:mail', '/Other.app': 'data:other' })[0]).toBe(icon)
  expect(present([app], { '/Mail.app': 'data:new' })[0]).not.toBe(icon)
  expect(present([app], {})[0]).toBe(app)
  const original = { ...app, icon: 'data:original' }
  expect(present([original], {})[0]).toBe(original)
})
