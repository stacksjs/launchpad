# Launchpad privacy policy

Effective October 27, 2026.

Launchpad stores your quicklinks, snippets, favorites, clipboard history and launcher activity in a local SQLite database in its macOS application container. No Stacks account or hosted API is required. Launchpad does not upload this database to Stacks, run advertising or include an external analytics SDK.

## Applications and shortcuts

Launchpad reads standard Applications directories to find and open apps, and asks macOS for their real icons. Command + Space registers that specific shortcut with macOS. It does not monitor all keystrokes. Application names may be included in local command activity, but the installed-app inventory is not sent to Stacks.

## Clipboard History

Background recording is off until you enable it in Settings. Enabling starts with new copies and does not import the existing clipboard. Launchpad saves plain text, skips protected or transient pasteboard types, and applies additional exclusions for known credential apps. These checks cannot recognize every secret: unmarked passwords or other sensitive text can be captured. Pause history before copying material you want to keep private.

History keeps at most 200 entries and removes entries older than the selected 1, 7 or 30 day retention period while the app runs. Choose Clear history in Settings, or delete individual entries from the Clipboard category using the selected item's Delete control. Save current clipboard explicitly reads and stores the current text when you request it. Copying snippets, calculations or history items puts their text on the macOS clipboard, where other apps may read it subject to system permissions.

## Local activity and year review

Local activity records process sessions, palette opens, time the app runs in the background, time the palette is open, successful app and link opens, action types, command categories, application names, timestamps, timezone offsets, app version and command latency. Pantry install receipts additionally retain package identifiers, package types, success or failure, request/start/finish times and job IDs. Recording preference intervals let Launchpad exclude jobs that cross a paused period and prevent cleared jobs from reappearing. Install output, error messages and connection tokens are excluded from usage records. Running and visible time are checkpointed in cumulative daily records, with long sleep or suspension gaps excluded. These records support counts, active days, streaks and a future year review. They exclude search queries, URLs, file paths, clipboard text and snippet contents. They stay on this Mac and are separate from clipboard history. Turn off Record local usage to stop new records, or choose Clear usage history to remove retained events, time totals, install receipts and recording intervals. Command ranking also maintains local favorites and execution counts.

## Files, windows, contacts and calendar

File search asks macOS Spotlight for file names in your home folder and shows the matches. The names are never saved, sent anywhere, ranked by use or recorded in activity. You can turn file search off in Settings.

The Windows, People and Calendar tabs ask the apps that own that information through macOS scripting. Windows uses the Accessibility permission to list and raise windows. Contacts and Calendar use the Automation permission, which macOS asks you to approve the first time. Window titles, contact details and event titles are held in memory while you use the tab and are not written to the local database, sent anywhere or included in usage records. A contact's email address or phone number is copied only when you choose Copy. You can revoke these permissions at any time in System Settings under Privacy & Security.

Pasting a snippet into another app is off until you enable it. It copies the snippet and sends the Command V keystroke to the app that was in front, which needs the Accessibility permission. Snippet placeholders read the clipboard only when a snippet contains `{clipboard}`.

## Exchange rates and web searches

Currency conversion is off until you enable exchange rates in Settings. Once on, Launchpad downloads the European Central Bank's published reference rates about once a day from api.frankfurter.dev. The request contains no search text and no identifier beyond what any web request reveals, such as your IP address, which that service receives. The rates are stored locally. Unit and temperature conversions never use the network.

The Search the web row opens your browser with your search text in the address of the engine you choose in Settings. That site and your browser have their own privacy practices. Nothing is sent until you choose the row.

## Extensions

An extension is a JSON file you paste into Settings. It can add quicklinks and snippets and nothing else: it cannot run code, make network requests or read files, and its manifest is checked strictly before it is saved. Installed manifests are stored in the local database and can be disabled or removed at any time.

## GitHub and external websites

Using the GitHub category sends GitHub search text, repository scope and selected filters directly to GitHub's API. Connecting an account also sends its token for authentication. The token is stored in macOS Keychain, not the local database. Launchpad displays account and repository information returned by GitHub. Disconnect in Settings to remove the saved token. GitHub processes requests under its [privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement); its service may retain request and account information.

Opening a GitHub result or quicklink uses your default browser. Quicklink search arguments become part of the destination URL. That website and your browser have their own privacy practices. Local app, snippet and clipboard searches are not sent to GitHub.

## Storage and deletion

Launchpad provides no cloud synchronization. Local data remains until its retention period expires or you delete it. Uninstalling an app may leave its container and Keychain items behind. Disconnect GitHub and clear clipboard and usage history before removing the app if you want to remove those records. Saved commands and preferences can also be removed with the app's Application Support data.

Contact Chris Breuer at chris@stacksjs.com for privacy questions. [Support and issue reporting](https://github.com/stacksjs/launchpad/issues) are available on GitHub. Do not include personal clipboard contents, tokens or other sensitive text in public issues.

## Pantry

Package metadata is cached in the local model API. Catalog refreshes and original package logos are fetched from Pantry's GitHub repository, which receives normal network request information such as your IP address and the requested asset path. Package search text stays on your Mac.

Connecting Pantry creates a credential stored in macOS Keychain. The separately installed Pantry desktop service holds its hash and handles installations under your user account. Launchpad sends only the selected package identifier and a retry ID to the service on loopback. Pantry contacts its package registry and upstream sources to perform installations. Installation status and a bounded output log remain local. Disconnect in Settings to revoke Launchpad's connection.
