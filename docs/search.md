# Application search

Launchpad prepares the installed application index before searching. Each app
keeps its real display name, launch path and ranking record. Aliases add search
names to that same result; they do not create duplicate launch commands.

Search includes the bundle filename, localized display name, bundle name and
identifier. A meaningful product name at the end of a bundle identifier is also
searchable on its own. This finds renamed apps such as ChatGPT, whose identifier
can be `com.openai.codex`, without treating `com`, vendor names or generic suffixes
such as `desktop` as standalone aliases.

Built-in aliases cover common alternative names, abbreviations, former names and
launch intents: Codex / OpenAI for ChatGPT, preferences for System Settings,
iTunes for Music, email for Mail, task manager for Activity Monitor, shell for
terminal apps, PDF for Preview, and familiar Office, browser and editor names.
Rules match exact app identities, not unrelated helpers or arbitrary substrings.
Versions and release channels keep their own results.

Select an application and choose **Aliases** or press **Command E** to add your
own names. Use one alias per line, or separate them with commas or semicolons.
There can be up to 20 aliases of 64 characters each, within 1,000 characters
total. Clearing the field removes your aliases and retains the built-in names.
Aliases use the existing `LaunchRecord` model and its generated local API. The
native model boot upgrades older databases while retaining favorites, launch
counts and recency. Search queries are not stored or sent anywhere.

Exact app names rank above exact aliases, followed by name prefixes and strong
abbreviations, alias prefixes, other literal matches and then weak fuzzy matches.
Favorites, launch frequency and recency order results within each relevance tier.
Two browsers sharing the alias `browser` therefore follow your usage, while an
app actually named Codex still leads ChatGPT for an exact `codex` search.

Matching handles case, Latin accents, compatibility forms, spaced or punctuated
app names and an optional `.app` suffix. Symbols in names such as C++ and C# remain
distinct. Aliases are prepared once per data snapshot, and bounded query caches
reuse results while typing and backspacing. Editing aliases rebuilds that
snapshot immediately, so stale cached matches cannot outlive an edit.

## More than apps

Everything below appears in All when it matches, is also available as a tab, and is
described fully in the README.

**Files.** Names only, through Spotlight, in your home folder. Library, hidden items,
dependencies and the inside of apps and packages are never offered. Return opens the
file, Command Return reveals it in Finder, and Shift Command C copies its path.
Results are never stored, ranked by use or counted as launches.

**System commands.** Sleep, Lock Screen, restart, shut down, log out, Empty Trash, dark
mode, mute, eject and the System Settings panes are found by their names and familiar
phrases (`reboot`, `wifi`, `dark mode`). They come from a fixed table: a result can only
name a command in that table, never carry code. Restart, shut down, log out and Empty
Trash ask first. They stay out of the idle list.

**Conversions and the web.** `5 km in miles`, `72 f to c`, `1.5 gb in mb`, `100 usd to
eur`. Units and temperatures work offline. Currencies need the opt-in exchange rates in
Settings. Every search ends with a web search row, using the engine chosen in Settings.

**Emoji.** Start with a colon (`:rocket`) or use the Emoji tab. Return copies. Your own use
ranks first and ties follow the catalog, where common emoji come first.

**Windows, People and Calendar.** Live views of the apps that own them, shown only on
their tabs. Windows needs the Accessibility permission, Contacts and Calendar need
Automation. See [PRIVACY.md](../PRIVACY.md).

**Extensions.** Declarative packs of quicklinks and snippets installed from Settings.
A manifest is strictly validated and cannot run code, reach the network or read files.

**Snippet placeholders.** `{date}`, `{time}`, `{datetime}`, `{weekday}`, `{year}`, `{uuid}`
and `{clipboard}` are filled in when a snippet is used. `{{date}}` stays literal. The
clipboard is read only if the snippet asks for it.

**Large type.** Command L fills the window with the selected result, at the largest size that still
fits. A result whose point is its text — a snippet, a clipboard entry, a calculated answer, an emoji —
shows that text; everything else shows its title, since its content is a path or an address the title
already stands for. While it is up it holds the keyboard so the list behind cannot move, but Command C
still copies and the text stays selectable. Escape or a click outside closes it, and resizing the
window re-fits the text.

**Bookmarks.** Chrome, Brave, Edge, Vivaldi, Chromium and Arc keep their bookmarks as a JSON file
per profile, and Launchpad reads the ones you choose in Settings, across every profile that browser
has. They rank alongside apps and commands rather than sitting in a tab, and both the folder and the
site are searchable. Only `http` and `https` entries are offered, because a bookmark opens through
the shell. Reading is the whole of it: Launchpad never writes to a browser's bookmarks, and nothing
is read until a browser is chosen. Return opens in your default browser, not the one the bookmark
came from. Safari keeps a binary property list instead and is not read.

**Command shortcuts.** A quicklink or snippet can hold a shortcut that runs it wherever you are, with the
palette left closed. It is recorded by pressing the keys in the editor rather than typing their names, and it
has to carry Command, Control or Option, because a global shortcut without a modifier would swallow an
ordinary keystroke in every other app. The palette's own keys are refused for the same reason: a global
shortcut fires first and would stop the matching key working in the window. One another application already
owns is only discovered when macOS declines to register it, and Settings > Shortcuts reports that alongside
every shortcut in use.

**Granting Automation.** The Automation pane has no way to add an app. Launchpad appears
there only after macOS has asked, and each app it controls (Finder, System Events, Contacts,
Calendar) is its own switch under the Launchpad row. So the first grant is the prompt itself:
choose OK. If you chose Don't Allow, open System Settings > Privacy & Security > Automation and
switch that app on under Launchpad. If Launchpad is not listed at all, nothing has asked yet;
`tccutil reset AppleEvents com.stacksjs.launchpad` clears the record so the next attempt asks
again. Emptying the Trash also depends on the Finder warning in Finder > Settings > Advanced:
leave it on and answer the Finder dialog, or turn it off and let Launchpad's own confirmation
stand alone.

**Builds.** Direct downloads are hardened and carry the Apple events entitlement, which macOS
requires before it will even ask for the Automation permission. A sandboxed Mac App Store
build does not have that entitlement, and the sandbox can also stop Spotlight file search, so
files, windows, contacts, calendar and system commands may be unavailable there. Launchpad says
so in the tab instead of failing silently.
