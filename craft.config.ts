import type { NativeBuildConfig } from '@stacksjs/stx/craft'

export default {
  name: 'Launchpad', input: 'resources/views/launcher.stx', target: 'macos',
  icon: 'assets/Launchpad.icns',
  bundleId: 'com.stacksjs.launchpad', bundleStyle: 'executable',
  category: 'public.app-category.productivity', minimumSystemVersion: '13.0',
  systemTray: true, menubarOnly: false, hideDockIcon: true, runtimeProfile: 'webview',
  backend: { entry: 'app/Desktop/api.ts', maxRequestBodySize: 131072 },
  window: { title: 'Launchpad', width: 720, height: 450, frameless: true, transparent: false, cornerRadius: 12, resizable: false, alwaysOnTop: true, startHidden: true },
  infoPlist: { LSUIElement: true, NSHumanReadableCopyright: 'Copyright © 2026 Chris Breuer', NSAppleEventsUsageDescription: 'Launchpad asks Contacts and Calendar for the people and events you search for, lists and raises your open windows through System Events, and runs the system commands you choose.' },
} satisfies NativeBuildConfig
