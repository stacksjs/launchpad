# Native launcher research

Research date: 2026-10-26. Scope: a Stacks application built through `buddy new`, stx, Craft, native model definitions, and Pantry distribution. This is evidence and a proposed product plan, not evidence that the app has passed App Review.

## Product direction

Build a keyboard-first, local-first launcher with a small floating window. The main loop is summon, type, select, execute, dismiss. Searching and launching must remain useful without an account or network connection. Raycast's official quickstart combines app/file search, a contextual action panel, quicklinks, hotkeys and everyday utilities in this loop. [Raycast Quickstart](https://manual.raycast.com/quickstart)

The name should be distinct from Raycast and Apple's Launchpad. Availability of a product name is established only by successful repository and App Store Connect record creation, not a general web search.

## Feature priorities and acceptance criteria

| Priority | Feature | Definition of done |
| --- | --- | --- |
| P0 | Summon and dismiss | Cmd+Space works while a different app has focus, focuses the search input, toggles reliably, and Escape dismisses without quitting. A conflicting binding produces an actionable error. |
| P0 | Application search | Real installed apps appear with names and icons. Enter launches the chosen app through a public native facility. Empty search shows favorites/recent use; reindex reflects app changes. |
| P0 | Keyboard navigation | Up/down selection, Enter activation, Escape back/dismiss, Cmd+K contextual actions, visible focus, accessible names and selected-result announcement. |
| P0 | Quicklinks | Create/edit/delete from model-backed storage, search by name/alias, accept an argument with URL encoding, open safely and record usage. Invalid schemes never execute. |
| P0 | Calculator | Parse arithmetic without dynamic code execution. Support precedence, parentheses, unary signs and percentages; show invalid expressions and copy a valid result. |
| P0 | Snippet library | Persist title, content and tags; create/edit/delete/search; preview content and copy it to the clipboard with clear confirmation. |
| P0 | Private preferences | Persist shortcut, theme, favorites and history settings. Restart preserves state in the sandbox container. |
| P1 | Clipboard history | Explicit opt-in, permission-aware capture, pause, retention, deletion, sensitive-format exclusion, copy selection. Keep text on device and never log contents. |
| P1 | File search | Index only user-granted locations, persist security-scoped access, respect revocation, ignore common build/cache directories, open/reveal selected results. |
| P1 | Notes and useful text tools | Model-backed notes; case conversion, URL encoding, UUID generation and timestamp formatting that work offline. |
| Later | Provider integrations | Calendar/Reminders and network integrations need individual permission, privacy, account and failure designs. |
| Separate distribution investigation | Global text expansion and arbitrary window management | Do not claim Mac App Store support until the actual mechanism is qualified against Apple's sandbox restrictions. |

Quicklinks in Raycast support web URLs, local paths, deeplinks and parameterized searches. Its active-browser autofill needs Automation permission and selected-text quick search needs Accessibility. The proposed v1 should support explicit user-entered values first. [Raycast Quicklinks](https://manual.raycast.com/quicklinks)

Raycast snippets support a searchable library, keywords and global expansion. Copy-to-clipboard snippets are a useful independent capability; global expansion is a separate system-integration feature. [Raycast Snippets](https://manual.raycast.com/snippets)

Raycast's calculator is much broader than basic arithmetic: conversions, dates, time zones and currencies. Define supported syntax precisely and add unit conversions/date tools incrementally. Currency rates require freshness and network behavior. [Raycast Calculator](https://manual.raycast.com/calculator)

Raycast file search indexes local content and supports granting individual folders. A sandboxed implementation needs its own explicit access design rather than assuming unrestricted home-directory scans. [Raycast File Search](https://manual.raycast.com/file-search)

Aliases should prioritize exact matches before prefix matches and normal fuzzy matches, making repeated commands predictable. Raycast distinguishes aliases from actual global hotkeys. [Raycast aliases and hotkeys](https://manual.raycast.com/command-aliases-and-hotkeys)

## Apple constraints

Apple requires Mac App Store apps to be appropriately sandboxed, self-contained, and updated through the Store. Startup/login work requires consent, and app processes must not continue after quit without consent. Executable extension downloads require separate review against code-loading restrictions. A release needs complete metadata, working support/privacy links, truthful screenshots and functional on-device behavior. [App Review Guidelines, sections 2.1, 2.4.5, 2.5.2](https://developer.apple.com/app-store/review/guidelines/)

Apple lists accessibility use in assistive applications, arbitrary Apple Events, changing other apps' preferences and terminating other apps as incompatible with App Sandbox. This blocks assuming full Raycast automation parity in the Store build. User-granted access and public native APIs are required; requesting more entitlements alone is not proof that a feature works. [Protecting user data with App Sandbox](https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox)

General-pasteboard programmatic access can require user permission. `NSPasteboard.AccessBehavior` distinguishes default, ask, always allow and always deny. User-originated paste is treated differently. Background capture must respect this state and avoid repeated prompting. [NSPasteboardAccessBehavior](https://developer.apple.com/documentation/appkit/nspasteboard/accessbehavior-swift.enum?language=objc)

An App Store Connect app record is required before uploading. Apple documents creating it in Apps with the platform, name, language, bundle ID, SKU and access choice. Latest agreements must be accepted by the Account Holder. A signed-in Developer portal session alone does not prove these prerequisites or API access. [Add a new app](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app)

## Existing Craft implementation

The current Craft source already implements Carbon global shortcuts. Reuse `craft.shortcuts.register(id, 'Cmd+Space')`, `onPressed`, `onError`, `list` and cleanup. The registration Promise means the message was posted, not that macOS reserved the shortcut. Install error handling before registering, verify the registry and test an actual physical shortcut while another app is frontmost. Quit Raycast under the user's authorization before this test; detect any remaining Spotlight conflict instead of silently remapping system preferences.

Evidence: [public shortcut types](/Users/chris/Code/Tools/craft/packages/typescript/src/types.ts:1694), [Carbon native implementation](/Users/chris/Code/Tools/craft/packages/zig/src/macos_hotkey.zig:1), [shortcut bridge](/Users/chris/Code/Tools/craft/packages/zig/src/bridge_shortcuts.zig:1). Craft's native unit test dispatches a constructed Carbon event through the real event handler; that is useful implementation evidence but does not replace actual cross-app acceptance testing.

The existing macOS clipboard `readText` implementation immediately reads `stringForType:` and logs returned text at debug level. A privacy-aware history feature warrants a core improvement: expose permission state, change count and sensitive-format metadata, stop reading when denied, remove content logging, and distinguish permission failure from an empty clipboard. [Clipboard bridge](/Users/chris/Code/Tools/craft/packages/zig/src/bridge_clipboard.zig:200)

## Existing Pantry automation and reusable gaps

The user-mentioned Tools location is absent. The active Pantry checkout is `/Users/chris/Code/pantry`, remote `pantry-pm/pantry`.

| Existing module | Reuse |
| --- | --- |
| `native/config.ts` | Immutable Craft revision/version, commands, platform entitlements, bundle-size checks and store targets. |
| `native/build.ts` | Runtime provisioning, signing input preparation, sandbox entitlement gate and artifact manifest. |
| `native/release.ts` | Main-only release, clean tree requirement, qualification, version bump, conventional commit/tag/push through bumpx. |
| `native/pipeline.ts` | Frozen install, checks, artifact inspection, Developer ID direct release, separate sandboxed App Store build, signed package. |
| `app-store-connect.ts` | JWT API auth, bundle registration, capabilities, distribution certificates, matching provisioning profile, app/version/build lookup. |
| `app-store-submission.ts` | Localized metadata, privacy/support URLs, review contact, screenshots, price, age rating, encryption declaration and review submission. |
| `native/release-app-store.ts` | Package-signature validation, Apple validation/upload and checksum/delivery receipts. |
| `.github/workflows/native-app.yml` | Reusable macOS checks/release workflow with the encrypted production environment key as its declared secret. |

`provisionMacApp` explicitly reports initial App Store Connect app-record creation as a manual Apple step, because its supported public API has no app-creation endpoint. Complete that through the existing Dia session. Do not invent private Apple endpoints. After creation, Pantry can manage subsequent supported metadata and release operations. [Provisioning implementation](/Users/chris/Code/pantry/packages/ts-pantry/src/app-store-connect.ts:790)

The current pipeline is designed for direct distribution plus an optional Store build. It requires Developer ID inputs before the Store branch, so a Store-only project may expose a real reusable pipeline gap. Only change this if the app chooses Store-only delivery and verification demonstrates the unnecessary prerequisite. [Native release pipeline](/Users/chris/Code/pantry/packages/ts-pantry/src/native/pipeline.ts:49)

## Implementation order and release evidence

1. Scaffold the app through Buddy and retain Pantry's immutable runtime manifest. Add actual models for quicklinks, snippets, command usage, preferences, notes and clipboard items, using generated migrations and native CRUD. Avoid a second app-specific data layer.
2. Qualify the smallest native slice: model persistence, search, Enter execution, Cmd+Space and Escape in the installed Craft app.
3. Add calculator and saved-content workflows with empty/loading/error states and real integration tests.
4. Add permission-aware clipboard history and selected-folder search only after core native capability tests exist.
5. Capture screenshots from the actual app, configure Apple records/signing, produce a signed sandboxed package, verify installation/launch and validate through Apple tooling.
6. Run the requested patch release on a clean, integrated main. Record version, immutable build number, source revision, runtime revision and artifact checksum.
7. Upload, wait for processing, attach the actual build, prepare metadata, submit to App Review and report the returned state accurately. Upload, processing, review submission, approval and public availability are different states.

GitHub issues should mirror these independently testable slices, with explicit dependency links and observed completion evidence. Apple review timing and approval remain external outcomes; do not mark publication complete when only a tag or upload exists.

## v1 follow-up decisions

Clipboard History, themes, native app icons and GitHub views are included in v1. Text capture is opt-in, local and bounded by retention and a 200-item cap. Craft honors protected pasteboard types and declared source identifiers; an unmarked source remains unknown. See the [clipboard marker convention](https://nspasteboard.org/).

Usage for the future year review remains in the local model API. It stores UUID events, sessions, action categories, timestamps and timezone offsets. It excludes queries, URLs, paths and text contents. [Issue 8](https://github.com/stacksjs/launchpad/issues/8) tracks image export. This is separate from future paid AI allowance accounting.

Apple excludes on-device-only processing from its collection label. GitHub queries and optional authentication leave the device, so the Store setup declares Search History and User ID for functionality, linked to the account and unused for tracking. The policy explains this distinction. [Apple privacy definitions](https://developer.apple.com/app-store/app-privacy-details/)
