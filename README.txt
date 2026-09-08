Game Manager v1.0.0 - Production Readiness Phase 1

This starts the v1.0.0 stabilization pass from the tested v0.6.0 build.

NEW: UI ERROR BOUNDARIES
- Sidebar and main content are protected independently.
- A React render failure now shows an error panel instead of a fully blank window.
- Includes Try Again and console logging.

FIX: LIBRARY SNAPSHOT ACCURACY
- Snapshot persistence is now based on App.jsx's complete installed-game list.
- It no longer depends on the filtered/hidden subset passed to Sidebar.
- This fixes dashboard totals becoming incomplete after using Hidden view.

FIX: STALE UNINSTALLED GAMES
- The installed-library snapshot is replaced on scan instead of merged forever.
- Cached capability records for games no longer installed are automatically pruned.

NEW: ABOUT / VERSION
- Library Overview includes an About card.
- Reads app name and version from Tauri metadata.
- Adds a GitHub link through the Tauri opener.

DASHBOARD POLISH
- Analyzed Games now shows percentage library coverage.

Before release, set all app versions to 1.0.0:
  src-tauri/Cargo.toml
  src-tauri/tauri.conf.json
  package.json

Test:
  cd "C:\Game Apps\Game Manager\Rust\GameManager\src-tauri"
  cargo check

  cd ..
  npm run build
  npm run tauri:dev

Recommended tests:
1. Verify Dashboard total after normal scan.
2. Enter/leave Hidden Games and verify dashboard total remains correct.
3. Remove/uninstall a game, rescan, and verify stale dashboard data disappears.
4. Confirm About reports the expected version.
5. Confirm GitHub opens externally.
6. Verify game selection, launching, backups, filters and Known Issues.
7. Check dev console for React warnings/errors.


BUILD FIX
- Replaced the unavailable lucide-react "Github" icon export with "ExternalLink".
- Fixes Rollup/Vite build failure in src/components/AboutCard.jsx.


v1.0.0 PRODUCTION READINESS PHASE 2

UPDATER UX
- Replaces the passive Update Available notice with a functional installer.
- Install Update uses the Tauri updater object's downloadAndInstall().
- Shows download percentage when the updater reports total content length.
- Falls back to downloaded byte count when percentage is unavailable.
- Displays release notes.
- Displays readable install errors and supports Try Again.
- Successful install asks the user to close/reopen Game Manager.
- Later dismisses the notice for the current session.
- Update notification cannot be dismissed while installation is active.

UPDATER FAILURE HARDENING
- Failed startup update checks are non-fatal.
- A small notice explains that the update check failed while Game Manager
  continues to operate normally.

REPOSITORY URL
- Corrected to:
  https://github.com/GreatDanish1026/Game-Manager

RELEASE VALIDATION
- Adds V1_RELEASE_CHECKLIST.txt for full regression and release validation.

New:
  src/components/UpdateNotification.jsx
  V1_RELEASE_CHECKLIST.txt

Updated:
  src/App.jsx
  src/components/AboutCard.jsx

Test:
  npm run build
  npm run tauri:dev


v1.0.0 PRODUCTION READINESS PHASE 3

SILENT AUTOMATIC UPDATE FAILURES
- Automatic startup update checks no longer show an offline/network warning.
- Failures still log to the developer console.
- This avoids alarming users simply because they launched Game Manager offline.

MANUAL UPDATE CHECK
- About card now has Check for Updates.
- Manual checks show Checking, Up to Date, Update Available, or Error status.
- If an update is available, the existing Phase 2 update installer notification appears.
- Manual failures are shown because the user explicitly requested the check.

RELEASE CONFIGURATION VALIDATOR
- Adds scripts/validate-v1-release.ps1.
- Validates the three v1.0.0 version fields.
- Validates updater artifacts are enabled.
- Validates updater public key exists.
- Validates the endpoint uses GreatDanish1026/Game-Manager.
- Does not alter the Tauri identifier.

UPDATER SIGNING GUIDE
- Adds V1_UPDATER_SIGNING_GUIDE.txt.
- Covers required Tauri configuration, signing environment variables,
  signed builds, GitHub release expectations, and real upgrade testing.
- No private key or password is included anywhere in this package.

Updated:
  src/App.jsx
  src/components/GameDetails.jsx
  src/components/LibraryDashboard.jsx
  src/components/AboutCard.jsx

New:
  scripts/validate-v1-release.ps1
  V1_UPDATER_SIGNING_GUIDE.txt

Test:
  npm run build
  npm run tauri:dev

Then test Dashboard -> About -> Check for Updates both online and with the
network disconnected.


v1.0.0 PRODUCTION READINESS PHASE 4

SIGNED RELEASE ASSET PIPELINE
- Adds prepare-release-assets.ps1.
- Locates the signed NSIS installer and matching .sig.
- Renames/copies assets to stable GitHub-safe names.
- Automatically creates a Tauri v2 static latest.json.
- Uses windows-x86_64 platform metadata.
- Embeds the actual signature CONTENT as required by Tauri.

LOCAL VERIFICATION
- Adds verify-release-assets.ps1.
- Validates installer, .sig, JSON parsing, version, platform URL and signature.

OPTIONAL GITHUB RELEASE HELPER
- Adds publish-github-release.ps1.
- Uses GitHub CLI if installed/authenticated.
- Uploads installer, signature and latest.json.
- Requires explicit RELEASE confirmation before publishing.

GUIDE
- Adds V1_RELEASE_ASSET_GUIDE.txt with the full signed build -> prepare ->
  verify -> publish -> real-upgrade test sequence.

No private updater key is included.
