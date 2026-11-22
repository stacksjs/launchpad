import type { NativeAppStoreMetadata } from 'ts-pantry/native'

export default {
  locale: 'en-US',
  reviewNotes: 'Launchpad has been renamed Scout. The App Store listing is Scout by Stacks. The app includes the Scout app icon and improved keyboard scrolling in the search results. Newly installed apps are discovered when search opens and while it stays visible. Scout has no Dock icon. On first launch, General settings lets the user opt into launch at login. Subsequent starts stay hidden until Command + Space or the Scout menu bar icon is used. General settings also shows the actual macOS login registration status. Scout is a free keyboard launcher. Command + Space opens and focuses search; Escape and outside clicks dismiss it. Clipboard capture is opt in and text stays local. Usage records stay in the local model API. Public GitHub search works without an account. Pantry catalog search works without the Pantry CLI. Installation controls connect to a separately installed Pantry CLI service using a user-entered, single-use pairing code and a Keychain token. That external process installs selected catalog packages into user locations, including applications, libraries, command line tools and fonts. The Store app does not embed or spawn the installer. This external installer behavior is included for review; it is not hidden behind another distribution edition. Network entitlements: com.apple.security.network.server is required because the bundled helper process, stx-backend in Contents/MacOS, hosts the interface and the local model API for the app web view. It binds only to 127.0.0.1 on an ephemeral port, rejects any other host header or origin, and accepts one session token that exists only in that launch. It never listens on an external interface and no remote device can reach it. Without this entitlement the sandbox denies the bind and the app cannot open its window. com.apple.security.network.client is used for GitHub searches, Pantry catalog and logo downloads, and the loopback connection to the user-installed Pantry CLI service. Change for this submission: the bundled stx-backend uses Bun built with the upstream Unicode ICU 78.2 implementation. ICU is linked statically. The two bundled executables no longer import Apple’s system ICU library or the ICU symbols identified in the previous review. To verify the local service, disconnect from the internet, open the menu bar item and search for an installed app or run a calculation. The helper is stopped when the app quits.',
  subtitle: 'Your keyboard. More useful.',
  privacyPolicyUrl: 'https://github.com/stacksjs/launchpad/blob/main/PRIVACY.md',
  description: `Bring everyday actions to your keyboard.

Press Command + Space to open Scout from another app. Find an application, run a calculation, open a quicklink or copy reusable text.

• Search applications with fuzzy matching.
• Calculate arithmetic, percentages and powers, then copy the result.
• Create quicklinks with aliases and encoded search arguments.
• Save and edit snippets for text you use often.
• Favorite commands and let recent usage improve their ranking.
• Enable private Clipboard History with text previews and retention controls.
• Search GitHub repositories, issues and pull requests. Connect for assigned issues, reviews and notifications.
• Browse Pantry applications, command line tools, libraries and fonts with original logos. Connect a separately installed Pantry CLI to manage installations.
• Stay ready in the menu bar without a Dock icon. Choose launch at login in General settings.
• Choose System, Light or Dark appearance.
• Keep local command activity for a future year review, with pause and delete controls.

Your commands, clipboard history and usage records stay in the local macOS container. No Stacks account, advertising or cloud synchronization. GitHub searches go directly to GitHub, and an optional account token stays in macOS Keychain. Pantry catalog updates and original logos load from GitHub without sending package searches. Installation uses an independently installed Pantry CLI service under your user account, connected through loopback and a token kept in Keychain. Quicklinks open in your browser. Clipboard recording starts only when enabled; unmarked sensitive text can still be captured.

Free and open source. Built with Stacks, stx, ts-css and Craft. Requires an Apple Silicon Mac with macOS 15 or later.

If another app owns Command + Space, release that shortcut before using Scout.`,
  keywords: 'launcher,keyboard,search,shortcuts,quicklinks,snippets,clipboard,calculator,productivity,offline',
  supportUrl: 'https://github.com/stacksjs/launchpad/issues',
  marketingUrl: 'https://scout.stacksjs.com',
  copyright: '2026 Chris Breuer',
  primaryCategory: 'PRODUCTIVITY',
  contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT',
  price: '0',
  ageRating: { userGeneratedContent: true },
  releaseType: 'AFTER_APPROVAL',
  usesNonExemptEncryption: false,
  screenshots: [{ platform: 'MAC_APP_STORE', files: ['assets/screenshots/applications.jpg', 'assets/screenshots/applications-light.jpg', 'assets/screenshots/calculator.jpg', 'assets/screenshots/github.jpg', 'assets/screenshots/pantry.jpg', 'assets/screenshots/clipboard.jpg', 'assets/screenshots/general.jpg'] }],
  submitForReview: false,
} satisfies NativeAppStoreMetadata
