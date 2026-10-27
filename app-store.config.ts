import type { AppStoreMetadata } from 'ts-pantry'

export default {
  locale: 'en-US',
  subtitle: 'Your keyboard. More useful.',
  privacyPolicyUrl: 'https://github.com/stacksjs/launchpad/blob/main/PRIVACY.md',
  description: `Bring everyday actions to your keyboard.

Press Command + Space to open Launchpad from another app. Find an application, run a calculation, open a quicklink or copy reusable text.

• Search applications with fuzzy matching.
• Calculate arithmetic, percentages and powers, then copy the result.
• Create quicklinks with aliases and encoded search arguments.
• Save and edit snippets for text you use often.
• Favorite commands and let recent usage improve their ranking.
• Enable private Clipboard History with text previews and retention controls.
• Search GitHub repositories, issues and pull requests. Connect for assigned issues, reviews and notifications.
• Choose System, Light or Dark appearance.
• Keep local command activity for a future year review, with pause and delete controls.

Your commands, clipboard history and usage records stay in the local macOS container. No Stacks account, advertising or cloud synchronization. GitHub searches go directly to GitHub, and an optional account token stays in macOS Keychain. Quicklinks open in your browser. Clipboard recording starts only when enabled; unmarked sensitive text can still be captured.

Free and open source. Built with Stacks, stx, ts-css and Craft. Requires an Apple Silicon Mac with macOS 13 or later.

If another app owns Command + Space, release that shortcut before using Launchpad.`,
  keywords: 'launcher,keyboard,search,shortcuts,quicklinks,snippets,clipboard,calculator,productivity,offline',
  supportUrl: 'https://github.com/stacksjs/launchpad/issues',
  marketingUrl: 'https://github.com/stacksjs/launchpad',
  copyright: '2026 Chris Breuer',
  primaryCategory: 'PRODUCTIVITY',
  contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT',
  price: '0',
  ageRating: { userGeneratedContent: true },
  releaseType: 'AFTER_APPROVAL',
  usesNonExemptEncryption: false,
  screenshots: [{ platform: 'MAC_APP_STORE', files: ['assets/screenshots/applications.jpg', 'assets/screenshots/applications-light.jpg', 'assets/screenshots/calculator.jpg', 'assets/screenshots/github.jpg'] }],
  submitForReview: false,
} satisfies Omit<AppStoreMetadata, 'reviewContact'>
