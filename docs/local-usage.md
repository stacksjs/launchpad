# Local usage

Launchpad records usage through its authenticated bundled Stacks API. It uses
`app/Models/LauncherActivity.ts` for events and `app/Models/LauncherUsageDay.ts`
for cumulative time checkpoints. The native model boot creates or upgrades the
SQLite schema from these definitions. Existing event history is retained.

## What the metrics mean

| Metric | Meaning |
| --- | --- |
| App sessions | One `session_started` per bundled backend process, including across WebView reloads. |
| Palette opens | A transition from hidden to visible. Shortcut and focus callbacks for the same opening count once. |
| App running | Awake time while the bundled backend runs, including with the palette hidden. |
| Palette open | The part of running time when the palette is visible, including Settings and package details. |
| Apps opened | Successful application commands, including Open application in Pantry details. |
| Links opened | Successful quicklinks, GitHub result commands, and website links in the interface. |
| Commands | Successful app, quicklink, GitHub, snippet, clipboard and calculator commands. |
| Active days | Local calendar days with a palette opening, successful command or successful website link. Background time alone does not create an active day. |
| Day streak | The longest consecutive sequence of active local calendar days within the requested year. |

An open succeeds when the native operating-system bridge accepts it. Launchpad
cannot establish whether a destination website finished loading or an application
subsequently crashed. A failed bridge call does not count. Opening an already
running application still counts as an application command.

## API and persistence

- `POST /api/activity-events` validates an event through the generated model API.
  Each event has a UUID, action, kind, timestamp, timezone offset and command
  latency. Application commands may include the application name. Retrying the
  same UUID does not create another event. Session identity, app version and
  receipt time belong to the backend.
- `GET /api/activity-events` reads retained events through the native model API.
- `GET /api/usage-days` and `GET /api/usage-days/:id` expose time records through
  the generated read-only API. Clients cannot write timing records.
- `GET /api/activity-summary?year=2026` checkpoints time and returns counts,
  running and visible milliseconds, active days, streaks, command counts per day,
  tool counts, and the top ten applications for that calendar year.
- `DELETE /api/activity-events` clears both events and time records. The Usage
  setting's confirmation is required before the interface calls this endpoint.

The backend checkpoints every 15 seconds, on visibility changes, before reading
summaries, when changing usage preferences, and on graceful shutdown. One timing
row belongs to a process, local date and timezone offset. Writes replace
cumulative values, so a retry cannot add the same interval twice. Midnight
intervals split into separate day records. Command latency is separate from
running and visible time.

Timing uses a monotonic clock. Gaps longer than one minute are treated as sleep
or suspension and excluded. A crash or forced termination can lose the time since
the last checkpoint. Timing begins with the new version; historical event counts
remain available without estimating old durations.

## Preferences and privacy

Settings stores the `usage` preference through `AppPreference` and its native API.
Pausing stops new event and timing records. Resuming does not backfill the paused
period. Visibility state can still reach the backend while paused, without being
persisted, so timing resumes with the correct state.

Usage records exclude search queries, URLs, application paths, clipboard text,
and snippet contents. All records stay in Launchpad's local SQLite database.
They provide the source for a future year review without a hosted analytics
service. Clearing clipboard history and clearing usage history are separate
operations.

## Verification

The app tests exercise duplicate events and visibility callbacks, successful and
failed command dispatch, process restarts, pause/resume, sleep gaps, year and
midnight boundaries, history clearing, read-only time endpoints, and a schema
upgrade that preserves existing events. The native qualification also builds a
relocatable helper, performs its authenticated handshake, uses the real model API,
and verifies that hidden time stays out of visible time and shutdown saves its
final checkpoint.

Run the native qualification on macOS with the pinned Pantry runtime active:

```sh
bun run test:usage-native
```

For framework development, `CRAFT_BIN` can select a locally built Craft webview
runtime. The fixture uses its own temporary database and does not modify your
Launchpad history.
