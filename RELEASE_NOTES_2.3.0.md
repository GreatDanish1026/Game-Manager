# GameAtlas 2.3.0

GameAtlas 2.3.0 focuses on speed, responsiveness, and a clearer everyday experience. Game discovery and game pages now do less blocking work, expensive diagnostics run only when requested, and the main screens have been reorganized without removing existing information or tools.

## Highlights

### Faster startup

- Installed-game discovery now uses cached library data immediately while refreshing in the background.
- Launcher scans run in parallel where supported, reducing the time spent waiting at launch.
- Duplicate work during startup has been reduced.
- The landing screen becomes usable sooner while updated results continue loading.

### Faster, more responsive game pages

- PCGamingWiki requests are cached, deduplicated, time-limited, and performed concurrently where possible.
- Previously loaded PCGamingWiki data can be reused instead of being downloaded again for every visit.
- Compatibility, performance, graphics, and technical information no longer block the entire page while loading.
- Hardware detection is shared and cached across sections rather than repeatedly querying the system.
- Expensive local inspections and Windows diagnostics run away from the interface thread, preventing temporary hangs.

### Improved Game-page experience

- Reorganized cards and sections into a more logical order.
- Reworked the section navigator so it adapts to available screen width instead of requiring horizontal scrolling.
- Reduced visual overload while preserving every existing feature and piece of information.
- Controller details are now loaded only when the Controller Support section is opened.
- Loading feedback is less intrusive and no longer blocks navigation unnecessarily.

### Diagnostics are now on demand

Opening Technical & Troubleshooting no longer launches every diagnostic automatically. The following tools now run only when selected:

- Windows performance diagnostics
- Background-conflict scan
- Clean-launch options
- Shader-cache inspection
- Graphics-driver diagnostics
- Local technical detection

Existing results, actions, and rescan controls remain available.

### Refreshed landing screen

- Improved visual hierarchy and spacing.
- Clearer library overview and status information.
- More useful insights and shortcuts without crowding the initial view.
- Improved responsive behavior at narrower window sizes.

### More reliable update checks

- Update metadata containing a UTF-8 byte-order mark is now handled correctly.
- GameAtlas now distinguishes between the current published version and a development build that is newer than the latest public release.
- Missing or invalid signed platform entries produce a useful error instead of an incorrect “latest version” result.
- Signed updater installation continues to use Tauri's signature verification.

### Simplified signed release builds

- Added one self-contained PowerShell release script for Windows.
- Added one self-contained shell release script for Linux.
- Both scripts securely prompt for the updater signing-key password.
- Both scripts build signed updater artifacts and generate a validated, BOM-free `latest.json`.
- Windows and Linux metadata can be merged into the same multi-platform updater manifest.

## Platform packages

### Windows

Download and run the x64 setup executable from the release assets.

### Linux and Bazzite

Download the x86-64 AppImage, make it executable, and launch it:

```bash
chmod +x GameAtlas_2.3.0_x86_64.AppImage
./GameAtlas_2.3.0_x86_64.AppImage
```

## Upgrading

No library or settings migration is required. Install 2.3.0 over the existing version or use GameAtlas's signed update prompt when it is available.

## Notes for existing users

- The first library refresh may still take longer than later launches because GameAtlas must create its local cache.
- Technical scans intentionally remain idle until you choose to run them.
- No game information, diagnostics, or management functionality was removed in this release.

