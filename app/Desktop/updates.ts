import AppPreference from '../Models/AppPreference'
import { parsePreference } from '../../resources/functions/preferences'

const checkInterval = 6 * 60 * 60 * 1000

/** Runs in the native backend so hiding the WebView cannot suspend update checks. */
export function createAutomaticUpdates(updates: (request: Request) => Promise<Response | null>, now = Date.now) {
  let nextCheck = 0
  let busy = false
  let downloading = false
  return async () => {
    if (busy) return
    busy = true
    try {
      const preference = await AppPreference.where('key', 'updates').first()
      if (parsePreference(preference?.value).enabled === false) {
        downloading = false
        return
      }
      const invoke = (action = '') => updates(new Request(`http://localhost/api/updates${action ? `/${action}` : ''}`, { method: action ? 'POST' : 'GET' }))
      const response = await invoke()
      if (!response?.ok) return
      const status = await response.json()
      if (['unavailable', 'ready', 'installing', 'installed'].includes(status.phase)) {
        downloading = false
        return
      }
      if (['checking', 'downloading'].includes(status.phase)) return
      if (status.phase === 'available' && downloading) {
        await invoke('download')
        downloading = false
      }
      else if (now() >= nextCheck) {
        nextCheck = now() + checkInterval
        downloading = true
        await invoke('check')
      }
    }
    finally { busy = false }
  }
}
