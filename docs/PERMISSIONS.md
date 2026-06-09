# LibreBookmarkSync Permissions

Last updated: 2026-06-08

This document explains the extension permissions used by LibreBookmarkSync.

## Required Permissions

### `bookmarks`

Used to read, create, remove, count, and restore browser bookmarks.

### `storage`

Used to save extension settings, local sync history, local bookmark snapshots, bookmark counts, auto-sync safety state, and the optional local encryption password.

### `notifications`

Used to show upload, download, restore, and error notifications when notifications are enabled.

### `alarms`

Used for local timer-based auto sync. Auto sync is disabled by default and does not require an account.

## Optional Host Permissions

### `https://api.github.com/*`

Requested only when the user selects GitHub Gist as the optional compatibility storage backend and grants GitHub Gist permission from the options page. It is used for GitHub Gist API access.

### `https://gist.githubusercontent.com/*`

Requested only when the user selects GitHub Gist as the optional compatibility storage backend and grants GitHub Gist permission from the options page. It is used to download large or truncated Gist file content from GitHub raw content URLs.

### `*://*/*`

Reserved for user-configured WebDAV storage. The options page asks the user to grant permission for the configured WebDAV origin before WebDAV requests are made.

## No Account Backend

These permissions are not used for a LibreBookmarkSync account service. LibreBookmarkSync does not connect to `memoload.com` or any project-owned account backend.
