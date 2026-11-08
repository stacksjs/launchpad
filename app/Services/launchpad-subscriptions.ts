import type { lists } from '@stacksjs/newsletter/lists'
import type { subscribe } from '@stacksjs/newsletter/subscriptions'

/** Product membership belongs to the native pivot, so an existing subscriber can join another list too. */
export async function subscribeToLaunchpad(email: string, ports?: { lists: Pick<typeof lists, 'find' | 'create'>, subscribe: typeof subscribe }) {
  const address = email.trim().toLowerCase()
  if (address.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('A valid email is required')
  let native = ports
  if (!native) {
    const { lists } = await import('@stacksjs/newsletter/lists')
    const { subscribe } = await import('@stacksjs/newsletter/subscriptions')
    native = { lists, subscribe }
  }
  const slug = 'launchpad-updates'
  let list = await native.lists.find(slug)
  if (!list) {
    try { list = await native.lists.create({ slug, name: 'Launchpad updates', description: 'Launchpad releases and improvements.', isPublic: true }) }
    catch (error) {
      // Another request may have created the same native list while this one waited.
      list = await native.lists.find(slug)
      if (!list) throw error
    }
  }
  return native.subscribe(address, { list: list.id, source: 'launchpad' })
}
