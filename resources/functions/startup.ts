interface LoginService {
  isEnabled: () => Promise<boolean>
  enable: () => Promise<boolean>
  disable: () => Promise<boolean>
}

/** Read the OS setting and remember first setup without registering a login item. */
export async function initializeLogin(service: LoginService, initialized: boolean, remember: () => Promise<void>): Promise<boolean> {
  const enabled = await service.isEnabled()
  if (!initialized) await remember()
  return enabled
}

/**
 * Whether first run should ask about starting with the Mac.
 *
 * A launcher that is not running is not a launcher: the shortcut does nothing until someone opens the app by hand,
 * which is the thing the app exists to avoid. Registering silently would be the wrong answer — it is the person's
 * Mac and their login — so the question gets asked once, plainly, instead of being left as an unlit switch on a
 * settings pane they did not ask to see.
 *
 * Asked once only. Someone who declines has a toggle in General, and being asked again at every launch would be
 * worse than never being asked at all.
 */
export function shouldOfferLogin(initialized: boolean, enabled: boolean): boolean {
  return !initialized && !enabled
}

export async function setLoginEnabled(service: LoginService, enabled: boolean): Promise<boolean> {
  if (!await (enabled ? service.enable() : service.disable())) throw new Error('macOS could not update Launch at login. Check System Settings > General > Login Items.')
  return service.isEnabled()
}
