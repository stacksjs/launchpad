interface LoginService {
  isEnabled: () => Promise<boolean>
  enable: () => Promise<boolean>
  disable: () => Promise<boolean>
}

/** Register once, then honor changes made in macOS Login Items between launches. */
export async function initializeLogin(service: LoginService, initialized: boolean, remember: () => Promise<void>): Promise<boolean> {
  const enabled = await service.isEnabled()
  if (initialized) return enabled
  if (!enabled && !await service.enable()) throw new Error('Could not register Launchpad at login. Try again in Settings.')
  await remember()
  return service.isEnabled()
}

export async function setLoginEnabled(service: LoginService, enabled: boolean): Promise<boolean> {
  if (!await (enabled ? service.enable() : service.disable())) throw new Error('macOS could not update Launch at login. Check System Settings > General > Login Items.')
  return service.isEnabled()
}
