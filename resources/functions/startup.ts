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

export async function setLoginEnabled(service: LoginService, enabled: boolean): Promise<boolean> {
  if (!await (enabled ? service.enable() : service.disable())) throw new Error('macOS could not update Launch at login. Check System Settings > General > Login Items.')
  return service.isEnabled()
}
