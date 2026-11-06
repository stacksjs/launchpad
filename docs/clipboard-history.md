# Clipboard history

History is local to this Mac. Automatic recording uses Craft's protected
pasteboard snapshot API. Protected, transient, empty and oversized text is
skipped. The maximum saved text length is 20,000 UTF-16 units, matching the native
model validation. Unmarked sensitive text can still be captured.

## Recording boundaries

Pause invalidates clipboard reads and queued automatic writes immediately.
An already-issued storage request finishes before the pause operation completes.
Failure to save the paused preference leaves recording paused for the current
session and offers a retry; it never silently switches recording back on.

Starting or resuming establishes a pasteboard cursor without saving the current
text. The next new copy is eligible for recording. This prevents text copied while
paused from being backfilled. Save clipboard is an explicit manual action that
also works while automatic recording is paused.

Clear history invalidates delayed automatic and manual reads, blocks new saves,
waits for an accepted storage request to finish, then deletes the entries and
their clipboard ranking records. A fresh pasteboard cursor prevents the current
clipboard from refilling the history. Recording can continue with the next new
copy. A failed clear displays an error and can be retried.

## Retention and browsing

The native backend retains at most 200 entries for the selected 1, 7 or 30 days.
Legacy entries without a valid capture timestamp use their model creation time
for both display and expiration. Favorites remain subject to clipboard retention.
Save as snippet creates a separate native Command record when the editor is
submitted; that snippet survives history clearing and expiration. Cancelling the
editor writes nothing. The original clipboard entry is preserved.

History and search matches are newest first, with descending IDs breaking equal
timestamps. Searching covers the full text and source identity. Source filters
use exact bundle identifiers, including a separate Unknown source choice.
Recognizable names and icons come from installed application metadata; copied
text never supplies an application icon path. Sources that disappear remain a
zero-count filter until the person chooses another source or Show all apps.

Incoming copies follow the first row while someone is at the top. While reviewing
older entries, selection and scrolling follow the selected entry's identity.

Copy in the preview, or Command Return, writes the selected text and keeps the
palette open. Return retains the ordinary copy-and-close behavior. Successful
copies count as clipboard commands without placing clipboard text in usage
records; Copy here does not record a palette dismissal.

## Verification

```sh
./buddy lint
./buddy typecheck
./buddy test
./buddy build
bunx playwright install chromium
bun run test:ui
bun run test:clipboard-native
bun run test:usage-native
```

Browser acceptance uses the compiled native app HTML, isolated API fixtures and
the desktop mock bridge. It covers delayed reads and writes, pause and clear
boundaries, failed storage and retries, source filters and icons, snippet
conversion, keep-open copying, paging and narrow layouts in both appearances.
Screenshots are saved under `dist/ui-evidence/` using sample data.

The native clipboard check starts the actual packaged backend with a temporary
data profile. It verifies authenticated production routes, model validation,
retention, clearing, ranking cleanup and snippet/history/preference persistence
across a real backend restart. It does not read or modify the user's history.

CI runs these packaged-backend and browser checks before the native publishing
job. A failing acceptance check prevents release delivery.
