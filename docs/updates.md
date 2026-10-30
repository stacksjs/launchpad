# App updates

General settings and the tray menu offer Check for Updates. Checks run only when
requested. Download update verifies the release archive; Install and Restart
verifies the application and replaces the installed bundle through Craft.

The host uses `createNativeUpdateApi` from `@stacksjs/desktop`, behind stx's
authenticated loopback session. The browser cannot supply an installer URL, path
or signing policy. The framework adapts Pantry's release manifest and serializes
operations. A failed check is shown as an error, never as being up to date.

Direct downloads use Developer ID signing, hardened runtime and notarization.
They run outside the App Store sandbox so the native updater can replace the app
bundle. App Store builds retain the sandbox and use App Store updates; the
framework detects their receipt and directs users there.

Craft checks the SHA-256 again before installation, then verifies the macOS code
signature, Gatekeeper acceptance, signing team and bundle identifier. It stages
and swaps the bundle with rollback protection. The framework waits for the old
host to exit before relaunching. Local model data stays in Application Support. Existing sandbox installations
continue using their original container database through the framework data-path
resolver; the updater does not copy or merge databases.

Run `bun scripts/verify-updates.mjs` against the built app HTML with an available
Playwright browser to qualify the offline error, retry, download and restart
controls. `bun run test:usage-native` additionally verifies that the packaged
updater status endpoint requires the native session cookie.

For local release qualification on a Mac with an existing app container, use an
isolated profile so the command-line launch check does not open live data:

```sh
STX_DATA_HOME=/absolute/path/to/a/temporary-profile bun run release:patch
```

The shared desktop helper appends `Launchpad` to this root. Normal app launches
continue using the existing model database when the override is unset.
