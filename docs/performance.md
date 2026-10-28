# App discovery and search performance

Launchpad refreshes installed applications when the palette is activated or
focused, and every five seconds while it is visible. Periodic application scans
pause while the palette is hidden. Concurrent activation and focus reads share one
request. An unchanged list leaves the search and selection untouched. Discovery
also scans up to four folder levels below the application roots, without walking
inside app bundles or following directory symlinks.

All and Applications search the local command list and installed Pantry packages.
They do not search the full Pantry catalog. The Pantry page uses the SDK's
`createPackageCatalogSearch` to normalize and sort one immutable catalog snapshot,
then reuse its index across keystrokes. Replacing the catalog rebuilds the index.
Launch history and favorites still affect ranking.

Search ranks exact names first, then exact aliases, name prefixes and literal
identity matches. Trailing version numbers do not demote an app such as Things3
when searching for Things. Favorites and launch history break ties within the
same relevance tier. Weak fuzzy matches are hidden when a literal identity
match exists. Compact abbreviations and initials remain available when no
literal match exists.

Pantry package names, identifiers, aliases and executable names are separate
identity fields. Fuzzy matches cannot combine letters across these fields.
Descriptions are searchable by literal words on the Pantry page, and do not
produce package matches in All or Applications.

Native icons load for displayed results while the palette is open. Icon updates
do not rerank search results. Reads share a four-request concurrency limit and a
per-process cache, including unavailable icons. One unreadable icon does not
discard the other icons. Install-job polling only runs while jobs are pending.
Clipboard collection and the local usage checkpoints retain their existing
background behavior.

Run `bun scripts/benchmark-search.ts` to compare the previous per-query catalog
path with the prepared path. With 1,774 catalog packages, 112 applications and 40
installed package fixtures on this Mac, the measured 95th percentile was:

| Search | Previous | Prepared |
| --- | --- | --- |
| All | 33.9 ms | 0.07 ms |
| Pantry | 35.5 ms | 1.58 ms |

These timings cover search computation only. They exclude native bridge latency,
icon extraction and WebView rendering, and are measurements rather than timing
assertions in the test suite. The regression tests verify live discovery,
removals, request sharing, unchanged-list stability, installed-only preparation,
and bounded icon loading.
