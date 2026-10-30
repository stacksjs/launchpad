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
