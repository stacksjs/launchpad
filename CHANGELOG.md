# Changelog

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.1.7...v1.1.8)

## 🐛 Bug Fixes

- **ui**: preload application icons before scrolling into view ([b94378f](https://github.com/stacksjs/launchpad/commit/b94378f)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.1.8 ([e21b95e](https://github.com/stacksjs/launchpad/commit/e21b95e)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.1.6...v1.1.7)

## 🐛 Bug Fixes

- **clipboard**: discard stale history refreshes after clearing ([cff4d81](https://github.com/stacksjs/launchpad/commit/cff4d81)) _(by Chris Breuer <chris@stacksjs.com>)_
- **clipboard**: enforce recording boundaries and improve history actions ([390a9e7](https://github.com/stacksjs/launchpad/commit/390a9e7)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.1.7 ([7a08e8b](https://github.com/stacksjs/launchpad/commit/7a08e8b)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.1.5...v1.1.6)

## 🐛 Bug Fixes

- **clipboard**: show newest copies first and improve history review ([55adb9f](https://github.com/stacksjs/launchpad/commit/55adb9f)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.1.6 ([72d3787](https://github.com/stacksjs/launchpad/commit/72d3787)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.1.4...v1.1.5)

## 🐛 Bug Fixes

- **ui**: compact search header and polish update downloads ([c502679](https://github.com/stacksjs/launchpad/commit/c502679)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.1.5 ([3d56117](https://github.com/stacksjs/launchpad/commit/3d56117)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.1.3...v1.1.4)

## ✨ Features

- **settings**: add a Sync screen for carrying a setup between Macs ([3513a93](https://github.com/stacksjs/launchpad/commit/3513a93)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **transfer**: keep the file up to date in a folder the person named ([a2416a5](https://github.com/stacksjs/launchpad/commit/a2416a5)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **transfer**: write and read the settings file on a path the person picked ([674170b](https://github.com/stacksjs/launchpad/commit/674170b)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **transfer**: describe a setup as one file that another Mac can read ([24e824b](https://github.com/stacksjs/launchpad/commit/24e824b)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **modes**: search for a mode instead of naming them all at once ([f52d4aa](https://github.com/stacksjs/launchpad/commit/f52d4aa)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **passwords**: show saved logins and hand them back to open ([b0d663e](https://github.com/stacksjs/launchpad/commit/b0d663e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **passwords**: ask the 1Password CLI for titles, behind a setting ([da8a8d2](https://github.com/stacksjs/launchpad/commit/da8a8d2)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **passwords**: find a saved login without opening the manager ([cc74bd8](https://github.com/stacksjs/launchpad/commit/cc74bd8)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **grid**: show the Emoji tab as a grid ([de02d10](https://github.com/stacksjs/launchpad/commit/de02d10)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **grid**: lay results out as a grid where a column wastes the window ([1802736](https://github.com/stacksjs/launchpad/commit/1802736)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **detail**: open a long result as a page with Command Y ([b88f3b9](https://github.com/stacksjs/launchpad/commit/b88f3b9)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **detail**: read a long result into blocks worth a page ([604f81e](https://github.com/stacksjs/launchpad/commit/604f81e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **selection**: act on what another app handed over ([25f29ef](https://github.com/stacksjs/launchpad/commit/25f29ef)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **selection**: declare the Services menu entry in the bundle ([597546e](https://github.com/stacksjs/launchpad/commit/597546e)) _(by glennmichael123 <gtorregosa@gmail.com>)_ ([stacksjs/stx#2152](https://github.com/stacksjs/stx/issues/2152))
- read a selection handed over by macOS ([782cbae](https://github.com/stacksjs/launchpad/commit/782cbae)) _(by glennmichael123 <gtorregosa@gmail.com>)_

## 🐛 Bug Fixes

- **pantry**: wait for installed inventory before offering repair ([067c677](https://github.com/stacksjs/launchpad/commit/067c677)) _(by Chris Breuer <chris@stacksjs.com>)_
- **pantry**: show verified app readiness and recover incomplete installs ([b53bfc4](https://github.com/stacksjs/launchpad/commit/b53bfc4)) _(by Chris Breuer <chris@stacksjs.com>)_
- **backend**: serve the themes and extensions the interface asks for ([8e18f0c](https://github.com/stacksjs/launchpad/commit/8e18f0c)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **startup**: start with a fresh store rather than not at all ([f3684f7](https://github.com/stacksjs/launchpad/commit/f3684f7)) _(by glennmichael123 <gtorregosa@gmail.com>)_

## 📝 Documentation

- describe the settings file and correct the sync claim ([9be9982](https://github.com/stacksjs/launchpad/commit/9be9982)) _(by glennmichael123 <gtorregosa@gmail.com>)_

## 🔧 Chores

- release v1.1.4 ([4343088](https://github.com/stacksjs/launchpad/commit/4343088)) _(by Chris Breuer <chris@stacksjs.com>)_
- **deps**: align Pantry runtime and publishing at 0.11.171 ([1b0caf4](https://github.com/stacksjs/launchpad/commit/1b0caf4)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_
- _glennmichael123 <gtorregosa@gmail.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.1.2...v1.1.3)

## ✨ Features

- **music**: add a Music tab to the palette ([3f7d12d](https://github.com/stacksjs/launchpad/commit/3f7d12d)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **music**: play a track and read the player through the sources ([ea69632](https://github.com/stacksjs/launchpad/commit/ea69632)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **music**: read what is playing and search the library ([9465db0](https://github.com/stacksjs/launchpad/commit/9465db0)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **music**: control playback and volume from the palette ([24de592](https://github.com/stacksjs/launchpad/commit/24de592)) _(by glennmichael123 <gtorregosa@gmail.com>)_

## 🐛 Bug Fixes

- **deps**: take the Pantry release that finds Zig wherever it unpacks ([e76ddd9](https://github.com/stacksjs/launchpad/commit/e76ddd9)) _(by glennmichael123 <gtorregosa@gmail.com>)_ ([pantry-pm/pantry#285](https://github.com/pantry-pm/pantry/issues/285))
- **applescript**: stop blaming Automation for a script that never ran ([7b0bf13](https://github.com/stacksjs/launchpad/commit/7b0bf13)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **native**: pin the Craft runtime to 0.0.442 ([ee4a32d](https://github.com/stacksjs/launchpad/commit/ee4a32d)) _(by glennmichael123 <gtorregosa@gmail.com>)_

## 🔧 Chores

- release v1.1.3 ([6a5268c](https://github.com/stacksjs/launchpad/commit/6a5268c)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **deps**: update github actions (updated) (#14) ([3616a7c](https://github.com/stacksjs/launchpad/commit/3616a7c)) _(by [github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>](https://github.com/github-actions[bot]))_ ([#14](https://github.com/stacksjs/launchpad/issues/14))

## Contributors

- _glennmichael123 <gtorregosa@gmail.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.1.1...v1.1.2)

## ✨ Features

- browse folders from the File tab ([1d0b9d0](https://github.com/stacksjs/launchpad/commit/1d0b9d0)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- mark which results are folders ([0a49a03](https://github.com/stacksjs/launchpad/commit/0a49a03)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- read a folder for the File tab ([5025283](https://github.com/stacksjs/launchpad/commit/5025283)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- decide what a folder listing shows ([5ab2ade](https://github.com/stacksjs/launchpad/commit/5ab2ade)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- show the selected result in large type ([860bfe5](https://github.com/stacksjs/launchpad/commit/860bfe5)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- decide what large type shows and how big ([7428159](https://github.com/stacksjs/launchpad/commit/7428159)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- choose which browsers' bookmarks to search ([6d81e6f](https://github.com/stacksjs/launchpad/commit/6d81e6f)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- rank bookmarks alongside everything else ([cd8b2c7](https://github.com/stacksjs/launchpad/commit/cd8b2c7)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- find every profile a chosen browser keeps ([32a249e](https://github.com/stacksjs/launchpad/commit/32a249e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- read bookmarks from a Chromium profile ([f64e413](https://github.com/stacksjs/launchpad/commit/f64e413)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- list every shortcut in one place ([cf9475f](https://github.com/stacksjs/launchpad/commit/cf9475f)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- record a command's shortcut in the editor ([cb32ddf](https://github.com/stacksjs/launchpad/commit/cb32ddf)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- run a command from its own shortcut ([9fbf8f2](https://github.com/stacksjs/launchpad/commit/9fbf8f2)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- hold a shortcut on a saved command ([0447306](https://github.com/stacksjs/launchpad/commit/0447306)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- pass a theme between Macs ([69b681e](https://github.com/stacksjs/launchpad/commit/69b681e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- edit themes from Appearance settings ([8b83e4e](https://github.com/stacksjs/launchpad/commit/8b83e4e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- apply the saved theme to the palette ([71f8ff1](https://github.com/stacksjs/launchpad/commit/71f8ff1)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- hold a saved theme in the local model ([6449ccd](https://github.com/stacksjs/launchpad/commit/6449ccd)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- refine settings and add automatic native updates ([ded3110](https://github.com/stacksjs/launchpad/commit/ded3110)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🐛 Bug Fixes

- **deps**: install published native installer and update support ([23917b2](https://github.com/stacksjs/launchpad/commit/23917b2)) _(by Chris Breuer <chris@stacksjs.com>)_
- restore stored update settings when saves fail ([e851e8b](https://github.com/stacksjs/launchpad/commit/e851e8b)) _(by Chris Breuer <chris@stacksjs.com>)_
- finish software update settings and native publishing integration ([e583537](https://github.com/stacksjs/launchpad/commit/e583537)) _(by Chris Breuer <chris@stacksjs.com>)_
- serialize settings saves and clarify installer steps ([e794f7f](https://github.com/stacksjs/launchpad/commit/e794f7f)) _(by Chris Breuer <chris@stacksjs.com>)_

## 📝 Documentation

- describe folder browsing and what it leaves out ([f76227f](https://github.com/stacksjs/launchpad/commit/f76227f)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- describe large type and its key ([7ef0e21](https://github.com/stacksjs/launchpad/commit/7ef0e21)) _(by glennmichael123 <gtorregosa@gmail.com>)_

## ✅ Tests

- verify settings search restores every section ([29abf96](https://github.com/stacksjs/launchpad/commit/29abf96)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.1.2 ([6f87413](https://github.com/stacksjs/launchpad/commit/6f87413)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_
- _glennmichael123 <gtorregosa@gmail.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.1.0...v1.1.1)

## 📝 Documentation

- explain the ICU symbols in the bundled runtime to App Review ([1ba874d](https://github.com/stacksjs/launchpad/commit/1ba874d)) _(by Chris Breuer <chris@stacksjs.com>)_
- explain the loopback server entitlement to App Review ([41b2da5](https://github.com/stacksjs/launchpad/commit/41b2da5)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.1.1 ([0ef2f69](https://github.com/stacksjs/launchpad/commit/0ef2f69)) _(by glennmichael123 <gtorregosa@gmail.com>)_

## 🎉 Miscellaneous

- Merge pull request #16 from stacksjs/claude/app-issues-review-e7f207 ([b255a93](https://github.com/stacksjs/launchpad/commit/b255a93)) _(by Glenn Michael Torregosa <gtorregosa@gmail.com>)_ ([#16](https://github.com/stacksjs/launchpad/issues/16))

## Contributors

- _Chris Breuer <chris@stacksjs.com>_
- _Glenn Michael Torregosa <gtorregosa@gmail.com>_
- _glennmichael123 <gtorregosa@gmail.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.12...v1.1.0)

## ✨ Features

- **launcher**: add Files, Windows, People, Calendar and Emoji tabs, Search and Extensions settings ([816012a](https://github.com/stacksjs/launchpad/commit/816012a)) _(by Chris Breuer <chris@stacksjs.com>)_
- **search**: compose files, windows, contacts, events, emoji and conversions in one tested pipeline ([944db7a](https://github.com/stacksjs/launchpad/commit/944db7a)) _(by Chris Breuer <chris@stacksjs.com>)_
- **sources**: add live window, contact and event sources with latest-wins loading ([3405dfa](https://github.com/stacksjs/launchpad/commit/3405dfa)) _(by Chris Breuer <chris@stacksjs.com>)_
- **extensions**: install declarative quicklink and snippet packs ([6119ec8](https://github.com/stacksjs/launchpad/commit/6119ec8)) _(by Chris Breuer <chris@stacksjs.com>)_
- **windows**: list, search and raise open windows; look up contacts and events ([2dd232d](https://github.com/stacksjs/launchpad/commit/2dd232d)) _(by Chris Breuer <chris@stacksjs.com>)_
- **snippets**: expand placeholders and run system plans through fixed ports ([0e8a71e](https://github.com/stacksjs/launchpad/commit/0e8a71e)) _(by Chris Breuer <chris@stacksjs.com>)_
- **emoji**: search emoji with a leading colon and copy with Return ([2763028](https://github.com/stacksjs/launchpad/commit/2763028)) _(by Chris Breuer <chris@stacksjs.com>)_
- **files**: search file names through Spotlight's index ([199ac78](https://github.com/stacksjs/launchpad/commit/199ac78)) _(by Chris Breuer <chris@stacksjs.com>)_
- **rates**: download euro based exchange rates once opted in ([5897823](https://github.com/stacksjs/launchpad/commit/5897823)) _(by Chris Breuer <chris@stacksjs.com>)_
- **search**: convert units, temperatures, data sizes and currencies ([7eaf768](https://github.com/stacksjs/launchpad/commit/7eaf768)) _(by Chris Breuer <chris@stacksjs.com>)_
- **search**: add a web search fallback, system commands and richer result dispatch ([9c5d800](https://github.com/stacksjs/launchpad/commit/9c5d800)) _(by Chris Breuer <chris@stacksjs.com>)_
- **a11y**: announce the result count and show full titles on hover ([7de4db3](https://github.com/stacksjs/launchpad/commit/7de4db3)) _(by Chris Breuer <chris@stacksjs.com>)_
- **keyboard**: navigate results with Control N and P and Page Up and Down ([9177995](https://github.com/stacksjs/launchpad/commit/9177995)) _(by Chris Breuer <chris@stacksjs.com>)_
- **search**: add aliases for Calculator, Maps, Xcode, Docker and other common apps ([9f6b58d](https://github.com/stacksjs/launchpad/commit/9f6b58d)) _(by Chris Breuer <chris@stacksjs.com>)_
- **calculator**: read thousands separators such as 1,250 ([3f36a98](https://github.com/stacksjs/launchpad/commit/3f36a98)) _(by Chris Breuer <chris@stacksjs.com>)_
- **a11y**: expose the selected category and settings tab to assistive tech ([34292c6](https://github.com/stacksjs/launchpad/commit/34292c6)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🐛 Bug Fixes

- **site**: label the issues link as Issues, not Roadmap ([8859e60](https://github.com/stacksjs/launchpad/commit/8859e60)) _(by Chris Breuer <chris@stacksjs.com>)_
- **commands**: explain blank names and trim quicklink addresses ([7c8a2a1](https://github.com/stacksjs/launchpad/commit/7c8a2a1)) _(by Chris Breuer <chris@stacksjs.com>)_
- **ui**: use correct singular counts and accept a pairing code typed in groups ([788f304](https://github.com/stacksjs/launchpad/commit/788f304)) _(by Chris Breuer <chris@stacksjs.com>)_
- **settings**: allow clearing the GitHub repository scope ([a154490](https://github.com/stacksjs/launchpad/commit/a154490)) _(by Chris Breuer <chris@stacksjs.com>)_
- **clipboard**: skip oversized or blank copies instead of stopping history ([fbc2aca](https://github.com/stacksjs/launchpad/commit/fbc2aca)) _(by Chris Breuer <chris@stacksjs.com>)_
- **pantry**: refuse oversized requests before reading the body ([8a4f075](https://github.com/stacksjs/launchpad/commit/8a4f075)) _(by Chris Breuer <chris@stacksjs.com>)_
- **usage**: drop activity events the local API will never accept ([d6c040f](https://github.com/stacksjs/launchpad/commit/d6c040f)) _(by Chris Breuer <chris@stacksjs.com>)_
- **ui**: delete ranking records with their item, label favorite and confirm setup copy ([d89adc3](https://github.com/stacksjs/launchpad/commit/d89adc3)) _(by Chris Breuer <chris@stacksjs.com>)_
- **github**: trim notification searches and tidy issue search queries ([12a52f4](https://github.com/stacksjs/launchpad/commit/12a52f4)) _(by Chris Breuer <chris@stacksjs.com>)_
- **history**: enforce the entry cap on rows beyond the newest thousand ([edd177d](https://github.com/stacksjs/launchpad/commit/edd177d)) _(by Chris Breuer <chris@stacksjs.com>)_
- **usage**: record application names the backend accepts and show days ([38a48e9](https://github.com/stacksjs/launchpad/commit/38a48e9)) _(by Chris Breuer <chris@stacksjs.com>)_
- **quicklinks**: explain a missing http or https address instead of Invalid URL ([216afd2](https://github.com/stacksjs/launchpad/commit/216afd2)) _(by Chris Breuer <chris@stacksjs.com>)_
- **pantry**: keep the catalog readable when one saved row is damaged ([36fc045](https://github.com/stacksjs/launchpad/commit/36fc045)) _(by Chris Breuer <chris@stacksjs.com>)_
- start even when a saved preference is damaged ([5c1ee40](https://github.com/stacksjs/launchpad/commit/5c1ee40)) _(by Chris Breuer <chris@stacksjs.com>)_
- **discovery**: survive unreadable folders and bundles during a scan ([06182cb](https://github.com/stacksjs/launchpad/commit/06182cb)) _(by Chris Breuer <chris@stacksjs.com>)_
- **github**: map notification links precisely and guard personal views ([4b98e70](https://github.com/stacksjs/launchpad/commit/4b98e70)) _(by Chris Breuer <chris@stacksjs.com>)_
- **calculator**: ignore bare numbers and accept pasted operator signs ([993596f](https://github.com/stacksjs/launchpad/commit/993596f)) _(by Chris Breuer <chris@stacksjs.com>)_

## ⚡ Performance Improvements

- answer file searches from memory and never overlap slow scripts ([1678511](https://github.com/stacksjs/launchpad/commit/1678511)) _(by Chris Breuer <chris@stacksjs.com>)_

## ♻️ Code Refactoring

- share the result row height between scrolling and icon loading ([22a324d](https://github.com/stacksjs/launchpad/commit/22a324d)) _(by Chris Breuer <chris@stacksjs.com>)_

## 📝 Documentation

- describe files, system commands, conversions, emoji, windows, contacts and extensions ([8d92199](https://github.com/stacksjs/launchpad/commit/8d92199)) _(by Chris Breuer <chris@stacksjs.com>)_

## 👷 Build System

- let the hardened direct build send Apple events ([cc621b1](https://github.com/stacksjs/launchpad/commit/cc621b1)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.1.0 ([a1b8d95](https://github.com/stacksjs/launchpad/commit/a1b8d95)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.11...v1.0.12)

## ✨ Features

- **search**: add intelligent application aliases and personal names ([870827e](https://github.com/stacksjs/launchpad/commit/870827e)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.12 ([8fb51d9](https://github.com/stacksjs/launchpad/commit/8fb51d9)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.10...v1.0.11)

## ✨ Features

- add native update controls in settings and tray ([e64d048](https://github.com/stacksjs/launchpad/commit/e64d048)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🐛 Bug Fixes

- qualify native releases with isolated app data ([ed83f64](https://github.com/stacksjs/launchpad/commit/ed83f64)) _(by Chris Breuer <chris@stacksjs.com>)_
- use the published native updater packages ([d00c62e](https://github.com/stacksjs/launchpad/commit/d00c62e)) _(by Chris Breuer <chris@stacksjs.com>)_
- support verified updates in direct Mac builds ([e29c3a7](https://github.com/stacksjs/launchpad/commit/e29c3a7)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.11 ([a911e18](https://github.com/stacksjs/launchpad/commit/a911e18)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.9...v1.0.10)

## ⚡ Performance Improvements

- dismiss launcher without waiting for usage writes ([221b79e](https://github.com/stacksjs/launchpad/commit/221b79e)) _(by Chris Breuer <chris@stacksjs.com>)_
- keep rapid searches fast and rank by full launch history ([258bdb0](https://github.com/stacksjs/launchpad/commit/258bdb0)) _(by Chris Breuer <chris@stacksjs.com>)_
- cache repeated queries and recycle visible result rows ([58584d5](https://github.com/stacksjs/launchpad/commit/58584d5)) _(by Chris Breuer <chris@stacksjs.com>)_
- reduce launcher indexing and search work ([c32901e](https://github.com/stacksjs/launchpad/commit/c32901e)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.10 ([380f37d](https://github.com/stacksjs/launchpad/commit/380f37d)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.8...v1.0.9)

## 🐛 Bug Fixes

- display localized app names while retaining filename aliases ([a5136a3](https://github.com/stacksjs/launchpad/commit/a5136a3)) _(by Chris Breuer <chris@stacksjs.com>)_

## 📝 Documentation

- use theme-neutral screenshot alt text ([b591caf](https://github.com/stacksjs/launchpad/commit/b591caf)) _(by Chris Breuer <chris@stacksjs.com>)_
- expand the project overview with screenshots and setup guides ([b10870b](https://github.com/stacksjs/launchpad/commit/b10870b)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.9 ([1c7f95a](https://github.com/stacksjs/launchpad/commit/1c7f95a)) _(by Chris Breuer <chris@stacksjs.com>)_
- use the published localized application metadata API ([f32327b](https://github.com/stacksjs/launchpad/commit/f32327b)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.7...v1.0.8)

## 🐛 Bug Fixes

- preserve spaced application abbreviations in search ([def36a3](https://github.com/stacksjs/launchpad/commit/def36a3)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.8 ([84c0783](https://github.com/stacksjs/launchpad/commit/84c0783)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.6...v1.0.7)

## 🐛 Bug Fixes

- preserve app abbreviations and literal Pantry keyword results ([783fa72](https://github.com/stacksjs/launchpad/commit/783fa72)) _(by Chris Breuer <chris@stacksjs.com>)_
- rank app identities ahead of unrelated package metadata ([4c016f2](https://github.com/stacksjs/launchpad/commit/4c016f2)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.7 ([f935f87](https://github.com/stacksjs/launchpad/commit/f935f87)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.5...v1.0.6)

## 🐛 Bug Fixes

- keep duplicate app names in a stable search order ([f48e7f2](https://github.com/stacksjs/launchpad/commit/f48e7f2)) _(by Chris Breuer <chris@stacksjs.com>)_
- preserve palette visibility when changing usage settings ([5eff9c0](https://github.com/stacksjs/launchpad/commit/5eff9c0)) _(by Chris Breuer <chris@stacksjs.com>)_
- refresh installed apps and reduce launcher search work ([50a2e5a](https://github.com/stacksjs/launchpad/commit/50a2e5a)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.6 ([5fe936f](https://github.com/stacksjs/launchpad/commit/5fe936f)) _(by Chris Breuer <chris@stacksjs.com>)_
- use the published Pantry search SDK and release workflow ([f6efa28](https://github.com/stacksjs/launchpad/commit/f6efa28)) _(by Chris Breuer <chris@stacksjs.com>)_
- document menu bar behavior for Apple review ([0634126](https://github.com/stacksjs/launchpad/commit/0634126)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.4...v1.0.5)

## 🔧 Chores

- release v1.0.5 ([a76c03c](https://github.com/stacksjs/launchpad/commit/a76c03c)) _(by Chris Breuer <chris@stacksjs.com>)_
- use published framework and Pantry patches ([b01f8ab](https://github.com/stacksjs/launchpad/commit/b01f8ab)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.3...v1.0.4)

## ✨ Features

- unify Command branding and generate native social images ([d21d395](https://github.com/stacksjs/launchpad/commit/d21d395)) _(by Chris Breuer <chris@stacksjs.com>)_
- run Launchpad in the menu bar and start at login ([eb0d763](https://github.com/stacksjs/launchpad/commit/eb0d763)) _(by Chris Breuer <chris@stacksjs.com>)_
- configure Launchpad production marketing domain ([d7d3eb8](https://github.com/stacksjs/launchpad/commit/d7d3eb8)) _(by Chris Breuer <chris@stacksjs.com>)_
- add Launchpad marketing site with native Stacks tooling ([b2614e2](https://github.com/stacksjs/launchpad/commit/b2614e2)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🐛 Bug Fixes

- require a user choice for login startup ([bd6940c](https://github.com/stacksjs/launchpad/commit/bd6940c)) _(by Chris Breuer <chris@stacksjs.com>)_
- clarify website shortcuts and label keyboard controls ([c25d842](https://github.com/stacksjs/launchpad/commit/c25d842)) _(by Chris Breuer <chris@stacksjs.com>)_

## 👷 Build System

- consume native site support from published Buddy ([00874b1](https://github.com/stacksjs/launchpad/commit/00874b1)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.4 ([a178f3f](https://github.com/stacksjs/launchpad/commit/a178f3f)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.2...v1.0.3)

## ✨ Features

- track Pantry install receipts by package kind ([f26087a](https://github.com/stacksjs/launchpad/commit/f26087a)) _(by Chris Breuer <chris@stacksjs.com>)_

## 👷 Build System

- consume Pantry receipt metadata through native releases ([f661f7c](https://github.com/stacksjs/launchpad/commit/f661f7c)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.3 ([fc8c50d](https://github.com/stacksjs/launchpad/commit/fc8c50d)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.1...v1.0.2)

## ✨ Features

- track local launcher sessions duration and successful opens ([fa65154](https://github.com/stacksjs/launchpad/commit/fa65154)) _(by Chris Breuer <chris@stacksjs.com>)_

## 📝 Documentation

- require Pantry native app installation support ([481e227](https://github.com/stacksjs/launchpad/commit/481e227)) _(by Chris Breuer <chris@stacksjs.com>)_

## 👷 Build System

- use published native lifecycle and verify usage persistence ([509c785](https://github.com/stacksjs/launchpad/commit/509c785)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.2 ([2abc84b](https://github.com/stacksjs/launchpad/commit/2abc84b)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v1.0.0...v1.0.1)

## ✨ Features

- publish Launchpad through the Pantry registry ([3643d77](https://github.com/stacksjs/launchpad/commit/3643d77)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🐛 Bug Fixes

- use readable Store profiles for the next v1 build ([7bab3f0](https://github.com/stacksjs/launchpad/commit/7bab3f0)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.1 ([8f024ef](https://github.com/stacksjs/launchpad/commit/8f024ef)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v0.1.2...v1.0.0)

## 🐛 Bug Fixes

- qualify native search editing and saved connections ([1d0b548](https://github.com/stacksjs/launchpad/commit/1d0b548)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v1.0.0 ([e55987d](https://github.com/stacksjs/launchpad/commit/e55987d)) _(by Chris Breuer <chris@stacksjs.com>)_
- pin the published native Buddy release ([8960946](https://github.com/stacksjs/launchpad/commit/8960946)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

[Compare changes](https://github.com/stacksjs/launchpad/compare/v0.1.1...v0.1.2)

## ✨ Features

- integrate Pantry and refine native palette behavior ([c7cbb45](https://github.com/stacksjs/launchpad/commit/c7cbb45)) _(by Chris Breuer <chris@stacksjs.com>)_

## 🔧 Chores

- release v0.1.2 ([12a4d34](https://github.com/stacksjs/launchpad/commit/12a4d34)) _(by Chris Breuer <chris@stacksjs.com>)_

## Contributors

- _Chris Breuer <chris@stacksjs.com>_

## 0.1.1

Initial development release with a native Command + Space palette, application search, calculator, quicklinks, snippets, Clipboard History, GitHub search, appearance settings, and local usage recording.

The release qualification stopped before producing an installable distribution because initial changelog generation emitted an empty file. The release tooling has been corrected for the next version.
