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

The result list mounts only the viewport plus two rows of overscan on each side.
Fixed-height spacers retain the full scroll range. Visible DOM slots are recycled
across queries and scrolling; their item bindings, absolute indexes, selection,
actions and accessibility positions all update together. Keyboard navigation and
Show more still address the full result list. Caching search alone did not avoid
the cost of updating 100 mounted rows on each keystroke.

Search ranks exact names first, then exact aliases, name prefixes and literal
identity matches. Trailing version numbers do not demote an app such as Things3
when searching for Things. Favorites and launch history break ties within the
same relevance tier. Compact application abbreviations and initials count as
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
