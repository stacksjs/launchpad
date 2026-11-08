import { route } from '@stacksjs/router'
import Unsubscribe from '@stacksjs/defaults/app/Actions/UnsubscribeAction.ts'
import Subscribe from '../app/Actions/LaunchpadSubscribeAction'

route.post('/subscribe', Subscribe).name('launchpad.subscribe').skipCsrf()
route.get('/health', () => Response.json({ ok: true, service: 'launchpad-api' }))
route.get('/email/unsubscribe', Unsubscribe).name('email.unsubscribe').skipCsrf()
