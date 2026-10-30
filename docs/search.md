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
