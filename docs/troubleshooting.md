# Launchpad troubleshooting

## Command + Space does not open search

Open Launchpad from Applications, or click its menu bar icon. If another launcher
uses Command + Space, release that shortcut there and reopen Launchpad. Check
macOS System Settings → Keyboard → Keyboard Shortcuts → Spotlight too.

## An application will not open

The palette hides before macOS starts an application. If macOS refuses the
request, Launchpad restores the palette and shows the error. Open the application
in Finder to check for a macOS permission or security prompt. Newly installed
applications appear when you open search; visible search also refreshes discovery.

## Suggestions and scrolling

Suggested uses your existing local favorites, frequency and recent launches.
New installations start with familiar apps that are actually installed. Search
and category views show the complete list; scrolling loads nearby rows without
a “Show more” button. Search queries and clipboard content are not suggestion inputs.

## Pantry installations

Install Pantry separately and run `pantry desktop setup --yes`. Pair it in
Settings → Pantry. Refresh the connection after updating Pantry. Managed packages
have uninstall and reinstall actions; apps installed elsewhere are not removed.

## Clipboard, permissions and privacy

Enable Clipboard History in Settings. Accessibility is needed for window switching
and optional paste actions; Contacts, Calendar and Music use their own Automation
permissions. Launchpad shows the relevant settings shortcut when macOS denies access.

## Send a useful report

Choose Copy Diagnostics from Launchpad’s menu bar menu and include the text in a
GitHub issue with the steps to reproduce. It contains app version, bundle identity
and sandbox status. Open Console opens macOS Console; filter for Launchpad to
review local system logs before sharing anything. Clipboard content, access tokens,
application paths and usage history are not included in Copy Diagnostics.
