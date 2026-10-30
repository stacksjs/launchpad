# App discovery and search performance

Launchpad discovers applications in `/Applications`, `/System/Applications` and
`~/Applications`, up to four folder levels below those roots. It does not walk
inside app bundles, follow directory symlinks or index document contents. Search
does not use Spotlight's index.

The palette checks the application list on activation, focus and every five
seconds while visible. The backend reuses its last snapshot until a filesystem
event invalidates it or it is 30 seconds old. Directory watchers cover only the
discovery folders; they never watch app resource trees. Events invalidate cached
data without starting a background scan. Missing roots are retried, removed
watchers and metadata are released, and concurrent requests share one scan.
An unchanged list leaves search and selection untouched.

The safety refresh catches missed notifications and metadata changes inside
existing bundles, including localized names. Such changes can take up to 30
seconds to appear while the palette is visible. Hidden palettes do not run the
discovery timer; the next activation reconciles changes.

Application titles use the desktop package's localized macOS bundle metadata.
The bundle filename and identifier remain search aliases. Launch paths and
favorite/history keys stay tied to the bundle path, so a corrected display name
preserves those records. Missing name metadata falls back to the filename.

All and Applications search the local command list and installed Pantry packages.
They do not search the full Pantry catalog. The Pantry page uses the SDK's
`createPackageCatalogSearch` to normalize and sort one immutable catalog snapshot,
then reuse its index across keystrokes. Local results and Pantry results also
prepare normalized fields, words, initials and ranking tie-breakers once per
data snapshot. Empty-query ordering is reused. SDK catalog candidates select
prepared Pantry results without rebuilding result objects on every keystroke.
Changing commands, installed packages, favorites, history or catalog data
rebuilds the relevant snapshot.

Each snapshot also retains the most recent 64 query results. Backspacing and
reopening an unchanged search reuse those arrays. Pantry caches the full SDK
candidate lookup and ranking together, scoped to the current package filter.
Icon presentation keeps unchanged result objects instead of cloning every row
when a query or an unrelated icon changes.

The result list keeps a small pool of 13 DOM slots for the fixed-height native
window, showing the viewport plus two rows of overscan on each side. Unused slots
are hidden, disabled and removed from accessibility navigation. They remain
available when backspacing expands a narrow or empty search, avoiding new row
construction. Source-data changes reset parked contents, including clipboard
clearing and GitHub disconnection. Fixed-height spacers retain the full scroll
range. Item bindings, absolute indexes, selection, actions and accessibility
positions update together. Keyboard navigation and Show more still address the
full result list. Scroll anchoring is disabled so recycled rows cannot shift the
selected result out of view. Caching search alone did not avoid the cost of
updating 100 mounted rows on each keystroke.

Search ranks exact names first, then exact aliases, name prefixes and literal
identity matches. Trailing version numbers do not demote an app such as Things3
when searching for Things. Within the same relevance tier and fuzzy distance,
explicit favorites lead, followed by total successful Launchpad launches, then
most recent use. Launch frequency has no 25-use ceiling: with Mail launched 400
times and Maps 80 times, `M` puts Mail first even if Maps was used more recently.
An exact `Maps` search still puts Maps first. This history measures commands
launched through Launchpad, not application activity elsewhere in macOS. It
persists through the native LaunchRecord API, and updated records invalidate
cached search results immediately. Compact application abbreviations and initials count as
name matches. Other weak fuzzy matches are hidden when a literal identity
match exists.

Pantry package names, identifiers, aliases and executable names are separate
identity fields. Fuzzy matches cannot combine letters across these fields.
Descriptions are searchable by literal words on the Pantry page, and do not
produce package matches in All or Applications.

Native icons load for the visible viewport plus two rows of overscan while the
palette is open, including when scrolling with the keyboard. Requests debounce
for 50 ms to avoid extracting icons for intermediate queries. Settings, command
editing and package details stop scheduling result icons. Remote logos use lazy
loading and asynchronous image decoding. Icon updates
do not rerank search results. Reads share a four-request concurrency limit and a
per-process cache, including unavailable icons. One unreadable icon does not
discard the other icons.

Inactive polling intervals are paused, removing their timer wakeups rather than
only skipping their callbacks. Install polling runs only for pending jobs,
clipboard polling only when history is enabled, and usage retries only while
events are queued. Usage summaries refresh only while their settings page is
visible. Enabled clipboard collection and the backend's 15-second usage
checkpoints retain their existing background behavior and recording semantics.

GitHub debounce timers run only in the visible GitHub category. Changing the
query, leaving the category or hiding the palette aborts the superseded HTTP
request and clears its loading state.

## Command dismissal

Once the native operating-system bridge accepts an application, link or copy,
the dispatcher queues its activity and starts hiding the window without waiting
for activity persistence. The UI's recording callback only queues events; the
existing background flush and retry mechanism finishes those writes. Launch
ranking writes happen after dismissal. Denied launches keep the palette open
and do not count as successful commands. A recording error cannot prevent a
confirmed launch from hiding the palette.

`scripts/verify-dismissal.mjs` exercises the built launcher with the desktop
package's mock bridge and deliberately blocked usage HTTP writes. It verifies
that normal app launches and Pantry's Open application hide before persistence,
ranking still saves, denied launches remain visible, and successful commands
are recorded exactly once. It uses isolated fixture data and never launches a
real application or contacts the user's backend:

```sh
./buddy build
node scripts/verify-dismissal.mjs
```

The same optional Playwright module and browser executable environment
variables as the typing fixture apply.

## Measurements

Measured on this Mac on October 29, 2026 with 1,774 catalog packages, 112
applications and 40 installed package fixtures. The baseline is commit
`52b5171`. Search runs 30 warmups followed by 300 queries, cycling through
`""`, `t`, `thi`, `things`, `git` and `source code`.

| Search | Baseline p95 | Prepared p95 | Baseline CPU, 300 queries | Prepared CPU, 300 queries |
| --- | --- | --- | --- | --- |
| All | 1.402 ms | 0.516 ms | 335.986 ms | 159.372 ms |
| Pantry | 6.606 ms | 2.722 ms | 904.868 ms | 417.358 ms |

Preparing both search snapshots took 38.197 ms once, excluded from query
measurements. The measured query CPU reduction was about 53–54%.

For 120 unchanged discovery reads after warmup, rescanning consumed 423.724 ms
of process CPU, versus 0.330 ms for watched snapshots. The corresponding p95
elapsed times were 4.225 ms and 0.0042 ms. These reads exclude startup, watcher
setup, invalidation and periodic safety scans; they do not represent whole-app
CPU consumption.

Reproduce the baseline comparison and discovery measurement:

```sh
git show 52b5171:resources/functions/search.ts > /tmp/launchpad-search-baseline.ts
bun scripts/benchmark-search.ts /tmp/launchpad-search-baseline.ts
bun scripts/benchmark-discovery.ts
```

Without a baseline path, the search benchmark compares preparing the current
search implementation on each query against reusing prepared snapshots.

These timings cover search computation only. They exclude native bridge latency,
icon extraction and WebView rendering. Other activity on the Mac noticeably
affects elapsed times; these are observations, not timing assertions in CI. The
tests cover discovery freshness and fallback, removals, shared requests,
unchanged-list stability, prepared search semantics, installed-only preparation,
viewport icon demand, bounded icon loading and HTTP cancellation.

## Typing and rendering

A follow-up browser fixture reproduced the `m` stall even with the prepared
search implementation. With 112 application fixtures (including bundle aliases
that match `m`), 1,774 Pantry entries and a 720 × 450 viewport, the Chromium
input-handler measurement was:

| All category, typing `m` | Before (`c32901e`) | Recycled viewport rows |
| --- | --- | --- |
| Median handler time | 147.1 ms | 11.6 ms |
| p95 handler time | 152.2 ms | 14.0 ms |
| Mounted result rows | 100 | 7 |

The updated Pantry fixture measured a median of 8.9 ms and p95 of 16.6 ms,
with five mounted result rows. Twelve clear-and-type cycles created zero new
result rows in both updated fixtures. Timings include input dispatch and the
reactive DOM update, exclude native icon extraction and compositor presentation,
and are Chromium fixture measurements rather than native WebKit guarantees.

`scripts/benchmark-typing.mjs` runs the built HTML with isolated synthetic data,
skips native startup and blocks external requests. It verifies mounted row bounds,
titles after scrolling and backspacing, keyboard selection and package actions
after slot reuse. With Playwright available in the development environment:

```sh
./buddy build
node scripts/benchmark-typing.mjs dist/Launchpad.app/Contents/Resources/index.html
```

`LAUNCHPAD_PLAYWRIGHT_MODULE` can select an installed Playwright module and
`LAUNCHPAD_BROWSER_EXECUTABLE` can select a Chromium executable.
`LAUNCHPAD_TYPING_CATEGORIES=all` restricts comparisons to the reported All case.
Additional HTML paths compare independently built versions with the same fixture.

The expanded regression fixture exercises complete typing and backspacing
sequences with no delay between inputs, including cold and warm caches, cache
eviction, zero results, Unicode quicklink arguments, multiword names, calculator
expressions and Pantry descriptions/program names. It uses 112 application
fixtures, 200 clipboard entries, commands and the complete Pantry catalog. A run
of 1,204 input events across all seven categories measured:

| Category | Input events | Median handler | p95 handler |
| --- | --- | --- | --- |
| All | 288 | 1.0 ms | 5.7 ms |
| Applications | 192 | 2.6 ms | 12.7 ms |
| Quicklinks | 172 | 2.5 ms | 3.3 ms |
| Snippets | 112 | 2.1 ms | 3.0 ms |
| Clipboard | 160 | 2.2 ms | 3.4 ms |
| Pantry | 168 | 5.3 ms | 10.3 ms |
| GitHub | 112 | 2.0 ms | 2.4 ms |

Each input checks that the visible rows match the current query state and that
no new result-row nodes are created. The fixture also checks rapid keyboard
navigation, Show more, bottom-of-list scrolling, current-row actions, clearing
parked contents, and reranking an already-cached `M` query after changing launch
frequency. A database test verifies history after reopening the native database.
GitHub HTTP responses are simulated locally to verify debouncing, cancellation
and rejection of obsolete responses. GitHub's input timing excludes the
400-millisecond debounce and network response latency; remote results remain
asynchronous. These browser observations are not timing guarantees on every Mac.

## Answering the Spotlight question

Suggested wording:

> Launchpad keeps a small app and command index rather than indexing your files.
> It caches discovery, reuses prepared search data and pauses discovery polling
> when hidden. That keeps its indexing work limited. We haven't run a controlled
> comparison with Spotlight, so I wouldn't claim a specific CPU advantage yet.

[Apple describes Spotlight](https://support.apple.com/en-us/102321) as system-wide
search backed by a regularly updated index of device data. The difference in
scope explains why Launchpad has less to index; it does not prove lower total
CPU usage. A comparison needs the same Mac, idle and active-search workloads,
fresh and steady-state indexing, all related processes, and the same optional
clipboard, integration and usage settings. Launchpad does not turn off macOS's
own Spotlight indexing.
