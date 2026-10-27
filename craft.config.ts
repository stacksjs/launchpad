import type { NativeBuildConfig } from '@stacksjs/stx/craft'

export default {
  name: 'Launchpad', input: 'resources/views/launcher.stx', target: 'macos',
  icon: 'assets/Launchpad.icns',
  bundleId: 'com.stacksjs.launchpad', bundleStyle: 'executable',
  category: 'public.app-category.productivity', minimumSystemVersion: '13.0',
  systemTray: true, menubarOnly: false, runtimeProfile: 'webview',
  backend: { entry: 'app/Desktop/api.ts', maxRequestBodySize: 131072 },
  window: { title: 'Launchpad', width: 720, height: 450, frameless: true, transparent: true, resizable: false, alwaysOnTop: true },
  infoPlist: { LSUIElement: true, NSHumanReadableCopyright: 'Copyright © 2026 Chris Breuer' },
} satisfies NativeBuildConfig
