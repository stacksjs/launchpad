# Launchpad

A native macOS launcher built with Stacks, stx, ts-css and Craft.

Press Command + Space to find apps, calculate, open quicklinks, copy snippets, search GitHub and revisit clipboard text. Real application icons come from macOS. Choose System, Light or Dark appearance in Settings.

Launchpad starts quietly in the menu bar with no Dock or app-switcher icon. Click its icon or press Command + Space to open the palette. Right-click the icon for Open, Settings and Quit. Hiding the palette keeps the app running. First launch shows General settings, where you can choose Launch at login through macOS Login Items. Subsequent launches respect changes made in System Settings.

| Shortcut | Action |
| --- | --- |
| Command + Space | Show and focus Launchpad |
| Command N | Create a quicklink or snippet |
| Command D | Favorite the selected result |
| Command Delete | Clear the search |
| Command G | Open GitHub search |
| Command Shift V | Open Clipboard History |
| Command comma | Open Settings |
| Escape | Hide the palette |

Clipboard History is opt-in. It records new text locally, skips protected pasteboard types, keeps at most 200 entries and supports 1, 7 or 30 day retention. Unmarked sensitive text can still be saved. Pause recording before copying private material. Saved items have a text preview and can be removed individually or cleared in Settings.

GitHub includes repositories, issues, pull requests, assigned issues, review requests and notifications. Public search works without signing in. An optional personal access token is stored in macOS Keychain. Use repository scope to narrow results. GitHub searches go directly to GitHub; local launcher searches stay on your Mac.

Local activity supports a future year review: process sessions, palette opens, successful app and link opens, tool categories, application names and command latency. The bundled backend checkpoints running time and palette-open time through Stacks models every 15 seconds, using compact daily totals. Running time includes the background launcher; gaps over one minute from sleep or suspension are excluded. An unexpected quit can lose time since the last checkpoint. Timing starts with this version; older activity remains available without inventing historical durations. Search queries, URLs, file paths, clipboard text and snippet contents are excluded from activity records. Pantry job receipts provide successful and failed install counts for apps, CLI tools, libraries and fonts, with known job durations. Duplicate jobs count once. Settings lets you inspect, pause and clear events, time totals and install receipts. No hosted usage API or cloud sync is enabled. See [the local usage contract](docs/local-usage.md) for metric definitions and API behavior.

## Install with Pantry

Requires [Pantry](https://pantry.dev) 0.11.142 or later for automatic app detection.

```sh
pantry upgrade
pantry install launchpad
```

Pantry installs the signed, notarized application into your Applications folder. The release action publishes each version through Pantry’s scanned registry using a token restricted to Launchpad.

## Branding and share images

The website, app icon and tray share the Command symbol. `assets/brand/launchpad.svg`
is the source mark. `bun run generate:brand` renders its PNG and macOS icon set
with ts-images and the native SVG renderer. Builds regenerate these assets.

`config/images.ts` declares one 1200 by 630 share card per website page. Buddy
generates it with ts-images during `bun run build:site`, using the real app capture,
the shared mark and bundled, licensed Geist fonts. Add a page entry there when
the website gains another route. Run `./buddy generate:images --social` to preview
the cards on their own.

## Development

Requires an Apple Silicon Mac, macOS 13 or later, Bun 1.3 or later and the Pantry runtime declared in `pantry.json`.

```sh
bun install
./buddy dev
./buddy lint
./buddy typecheck
./buddy test
```

Models under `app/Models` declare schema, validation and `useApi` routes for the compiled local backend. The authenticated loopback transport comes from stx. Craft owns the native window, global shortcut, application icons, clipboard and Keychain integration. Direct and Store builds use the macOS sandbox.

## Build and release

The marketing website uses stx pages in `resources/views/site`, ts-css utilities
and the real app screenshots in `public/images`. Run `./buddy dev --site` for
the local website with hot reload, or `./buddy build --site` to generate
`dist/site`. Website output is separate from the native app bundle. Plain
`./buddy dev` continues to launch the desktop app.

The production website is `https://launchpad.stacksjs.com`. The Stacks server's
[site catalog](https://github.com/stacksjs/stacks/blob/main/config/cloud.ts)
owns its `launchpad` static site. Stacks' deployment workflow checks out this
repository, installs its locked dependencies, and runs `bun run build:site`.
An operator with the Stacks deployment credentials can publish just this site
from the Stacks checkout with `./buddy deploy --prod --site launchpad --yes`.

`./buddy build` builds the app; `./buddy package` creates a disk image. `bun run release:patch` qualifies a clean main checkout before creating and pushing a version tag. Pantry's reusable workflow provisions the pinned runtime and handles signing, notarization, packaging and delivery. Release inputs are encrypted in `.env.production`; `.env.keys` stays private.

See [the v1 plan](docs/planning/v1.md), [primary-source research](docs/planning/research.md), [privacy policy](PRIVACY.md) and [feature issues](https://github.com/stacksjs/launchpad/issues). Store publication is confirmed only after Apple approval and availability.

Pantry includes applications, command line tools, libraries and fonts. All shows installed Pantry packages alongside your installed Mac apps and commands; the Pantry tab shows the full catalog. Open a package to see its original logo, upstream links, installed version and installation status. Connect the separately installed Pantry CLI in Settings using `pantry desktop setup --yes` and its single-use pairing code. Launchpad stores the token in macOS Keychain and sends installation requests to Pantry's local service.

Escape dismisses the palette immediately. Command + Delete clears the search; saved items have a separate Delete control. Clicking another app dismisses it through the native focus event. Command + Space opens the main search and focuses its input.
