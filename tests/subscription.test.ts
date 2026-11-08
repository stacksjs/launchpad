import { expect, test } from 'bun:test'
import { subscribeForUpdates, subscriptionEndpoint } from '../resources/functions/subscription'

test('submits only the chosen address to the native Launchpad subscriber endpoint', async () => {
  const calls: { url: string, init?: RequestInit }[] = []
  const send = (async (url: string, init?: RequestInit) => { calls.push({ url, init }); return Response.json({ success: true }) }) as unknown as typeof fetch
  await subscribeForUpdates(' Person@example.com ', send)
  expect(calls[0]?.url).toBe(subscriptionEndpoint)
  expect(calls[0]?.init?.method).toBe('POST')
  expect(JSON.parse(calls[0]?.init?.body as string)).toEqual({ email: 'Person@example.com' })
})

test('subscription failures remain retryable and never claim success for an HTTP-200 validation error', async () => {
  for (const response of [Response.json({ success: false, message: 'A valid email is required' }), Response.json({ message: 'Please wait' }, { status: 429 }), new Response('offline', { status: 503 })]) {
    await expect(subscribeForUpdates('person@example.com', (async () => response) as unknown as typeof fetch)).rejects.toThrow()
  }
})
