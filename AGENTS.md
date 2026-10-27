# Launchpad

Release only patch versions with `bun run release:patch` until Chris explicitly
changes this policy. This restriction also applies to framework and package
releases made for Launchpad. Do not run minor or major releases.

Launchpad is a native Stacks app built with stx and Craft. Use Buddy and Pantry's
native publishing workflow. Define local data in `app/Models/`; the native model
boot owns schema upgrades and generated APIs. Do not add hand-written schemas or
parallel persistence for application features.

Before changing usage collection, counters, timing, pause or clear behavior, read
[the local usage contract](docs/local-usage.md). Its records stay on this Mac.

Validate changes with `./buddy lint`, `./buddy typecheck` and `./buddy test`.
`bun run test:usage-native` additionally verifies the packaged backend on macOS
with the Pantry Craft runtime active, or an explicit `CRAFT_BIN` for development.

Branch before editing `main`. Integrate `origin/main` and publish completed work
as Chris Breuer <chris@stacksjs.com> with conventional commits, no coauthor
trailers, and a normal fast-forward push. Never force-push or move a release tag.
