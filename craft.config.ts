import type { NativeBuildConfig } from '@stacksjs/stx/craft'

export default {
  name: 'Scout', input: 'resources/views/launcher.stx', target: 'macos',
  icon: 'assets/Scout.icns',
  bundleId: 'com.stacksjs.launchpad', bundleStyle: 'executable',
  category: 'public.app-category.productivity', minimumSystemVersion: '15.0',
  systemTray: true, menubarOnly: false, hideDockIcon: true, runtimeProfile: 'webview',
  backend: { entry: 'app/Desktop/api.ts', maxRequestBodySize: 131072 },
  window: { title: 'Scout', width: 720, height: 450, frameless: true, transparent: false, cornerRadius: 12, resizable: false, alwaysOnTop: true, startHidden: true },
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
    LSUIElement: true,
    NSHumanReadableCopyright: 'Copyright © 2026 Chris Breuer',
    NSAppleEventsUsageDescription: 'Scout asks Contacts and Calendar for the people and events you search for, lists and raises your open windows through System Events, and runs the system commands you choose.',
    // macOS only offers a Service whose NSMessage matches the name the app registers at runtime, and it reads this
    // list once when the bundle is installed. Text is the only type Scout knows what to do with.
    NSServices: [{
      NSMenuItem: { default: 'Search with Scout' },
      NSMessage: 'searchWithLaunchpad',
      NSPortName: 'Scout',
      NSSendTypes: ['public.utf8-plain-text'],
    }],
  },
} satisfies NativeBuildConfig
