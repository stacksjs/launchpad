# Launchpad privacy policy

Effective October 26, 2026.

Launchpad stores your quicklinks, snippets, favorites, clipboard history and launcher activity in a local SQLite database in its macOS application container. No Stacks account or hosted API is required. Launchpad does not upload this database to Stacks, run advertising or include an external analytics SDK.

## Applications and shortcuts

Launchpad reads standard Applications directories to find and open apps, and asks macOS for their real icons. Command + Space registers that specific shortcut with macOS. It does not monitor all keystrokes. Application names may be included in local command activity, but the installed-app inventory is not sent to Stacks.

## Clipboard History

Background recording is off until you enable it in Settings. Enabling starts with new copies and does not import the existing clipboard. Launchpad saves plain text, skips protected or transient pasteboard types, and applies additional exclusions for known credential apps. These checks cannot recognize every secret: unmarked passwords or other sensitive text can be captured. Pause history before copying material you want to keep private.

History keeps at most 200 entries and removes entries older than the selected 1, 7 or 30 day retention period while the app runs. Choose Clear history in Settings, or delete individual entries from the Clipboard category with Command Delete. Save current clipboard explicitly reads and stores the current text when you request it. Copying snippets, calculations or history items puts their text on the macOS clipboard, where other apps may read it subject to system permissions.

## Local activity and year review

Local activity records action types, command categories, application names for app launches, timestamps, timezone offsets, sessions, app version and command latency. It supports counts, active days, streaks and a future year review. It excludes search queries, URLs, file paths, clipboard text and snippet contents. These activity records stay on this Mac and are separate from clipboard history. Turn off Record local usage to stop new activity, or choose Clear usage history to remove retained activity. Command ranking also maintains local favorites and execution counts.

## GitHub and external websites

Using the GitHub category sends GitHub search text, repository scope and selected filters directly to GitHub's API. Connecting an account also sends its token for authentication. The token is stored in macOS Keychain, not the local database. Launchpad displays account and repository information returned by GitHub. Disconnect in Settings to remove the saved token. GitHub processes requests under its [privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement); its service may retain request and account information.

Opening a GitHub result or quicklink uses your default browser. Quicklink search arguments become part of the destination URL. That website and your browser have their own privacy practices. Local app, snippet and clipboard searches are not sent to GitHub.

## Storage and deletion

Launchpad provides no cloud synchronization. Local data remains until its retention period expires or you delete it. Uninstalling an app may leave its container and Keychain items behind. Disconnect GitHub and clear clipboard and usage history before removing the app if you want to remove those records. Saved commands and preferences can also be removed with the app's Application Support data.

Contact Chris Breuer at chris@stacksjs.com for privacy questions. [Support and issue reporting](https://github.com/stacksjs/launchpad/issues) are available on GitHub. Do not include personal clipboard contents, tokens or other sensitive text in public issues.
