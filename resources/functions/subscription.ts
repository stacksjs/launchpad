export const subscriptionEndpoint = '/api/subscribe'

/** Public native Stacks subscriber action; credentials and subscriber records stay on the server. */
export async function subscribeForUpdates(email: string, send: typeof fetch = fetch): Promise<void> {
  const response = await send(subscriptionEndpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }), signal: AbortSignal.timeout(15000),
  })
  let result: { success?: boolean, message?: string }
  try { result = await response.json() }
  catch { throw new Error('Subscriptions are temporarily unavailable. Please try again.') }
  if (!response.ok || result.success !== true) throw new Error(result.message || (response.status === 429 ? 'Please wait a moment before trying again.' : 'Could not subscribe. Please try again.'))
}
