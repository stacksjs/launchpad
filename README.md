# Launchpad

A native macOS launcher built with Stacks, stx, ts-css and Craft.

Press Command + Space to find apps, calculate, open quicklinks, copy snippets, search GitHub and revisit clipboard text. Real application icons come from macOS. Choose System, Light or Dark appearance in Settings.

| Shortcut | Action |
| --- | --- |
| Command + Space | Show and focus Launchpad |
| Command N | Create a quicklink or snippet |
| Command D | Favorite the selected result |
| Command Delete | Delete a saved command or clipboard entry |
| Command G | Open GitHub search |
| Command Shift V | Open Clipboard History |
| Command comma | Open Settings |
| Escape | Close an editor, clear search or hide the palette |

Clipboard History is opt-in. It records new text locally, skips protected pasteboard types, keeps at most 200 entries and supports 1, 7 or 30 day retention. Unmarked sensitive text can still be saved. Pause recording before copying private material. Saved items have a text preview and can be removed individually or cleared in Settings.

GitHub includes repositories, issues, pull requests, assigned issues, review requests and notifications. Public search works without signing in. An optional personal access token is stored in macOS Keychain. Use repository scope to narrow results. GitHub searches go directly to GitHub; local launcher searches stay on your Mac.

Local activity supports a future year review: command counts, tool categories, application names, sessions, timestamps, timezone offsets and command latency. Search queries, URLs, file paths, clipboard text and snippet contents are excluded from activity records. Settings lets you pause recording and clear activity. No hosted usage API or cloud sync is enabled.

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

`./buddy build` builds the app; `./buddy package` creates a disk image. `bun run release:patch` qualifies a clean main checkout before creating and pushing a version tag. Pantry's reusable workflow provisions the pinned runtime and handles signing, notarization, packaging and delivery. Release inputs are encrypted in `.env.production`; `.env.keys` stays private.

See [the v1 plan](docs/planning/v1.md), [primary-source research](docs/planning/research.md), [privacy policy](PRIVACY.md) and [feature issues](https://github.com/stacksjs/launchpad/issues). Store publication is confirmed only after Apple approval and availability.
