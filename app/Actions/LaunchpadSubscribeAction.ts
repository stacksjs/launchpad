import { Action } from '@stacksjs/actions/runtime'
import { schema } from '@stacksjs/validation/runtime'
import { rateLimit } from '@stacksjs/router'
import { subscribeToLaunchpad } from '../Services/launchpad-subscriptions'

export default new Action({
  name: 'Subscribe to Launchpad updates',
  description: 'Join the native Launchpad subscriber list without altering other subscriptions.',
  method: 'POST',
  validations: { email: { rule: schema.string().email().max(255) } },
  async handle(request) {
    await rateLimit('launchpad-subscribe', 10).per('minute')
    const email = request.get('email')
    if (typeof email !== 'string') return Response.json({ success: false, message: 'A valid email is required' }, { status: 422 })
    await subscribeToLaunchpad(email)
    // Neither subscriber identity nor unsubscribe tokens belong in the public response.
    return { success: true, message: 'You’re subscribed to Launchpad updates.' }
  },
})
