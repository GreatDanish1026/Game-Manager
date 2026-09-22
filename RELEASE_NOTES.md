# GameAtlas 2.4.0

GameAtlas 2.4 expands troubleshooting and performance analysis across both Windows and Linux while introducing a new managed mod workflow for Linux players. This release focuses on actionable diagnostics, safer recovery tools, repeatable performance comparisons, and closer feature parity between native Windows games, native Linux games, and Windows games running through Proton or Wine.

## Highlights

- A coordinated Diagnostics Center with prioritized findings and links to focused tools.
- Crash, launch, display, runtime, configuration, and mod-conflict diagnostics on Windows and Linux.
- Repeatable performance captures with PresentMon on Windows and MangoHud on Linux.
- Per-game performance history, scene labels, baselines, and regression comparisons.
- Verified configuration backups, Safe Reset, and restore workflows.
- A Linux-only managed mod library with safe archive staging, profiles, conflict resolution, and reversible deployment.
- A testing integration with Nexus Mods for metadata, downloads, NXM links, provenance, and update checks.

## Windows

### Diagnostics Center

- Reworked Game Health into a coordinated Diagnostics Center.
- Runs installation, performance, graphics-driver, display, crash, runtime, configuration, background-application, and controller checks.
- Prioritizes findings by severity and provides direct navigation to the relevant troubleshooting tool.
- Keeps potentially destructive or state-changing actions separate from read-only analysis.

### Crash Detective

- Searches recent Windows Application Error and Application Hang records for the selected game.
- Reports timestamps, exception codes, faulting modules, and cautious troubleshooting guidance.
- Recognizes common graphics-driver, overlay, injector, runtime, DirectX, and Windows-system modules without treating the faulting module as definitive proof of the root cause.

### Display, HDR, and refresh-rate validation

- Reads active Windows display configuration, resolution, refresh rate, color depth, and HDR state.
- Identifies available higher refresh rates, mixed-refresh multi-monitor setups, and HDR configuration concerns.
- Includes per-game Windows GPU-preference context when available.

### Runtime and Dependency Doctor

- Inspects the game executable and installation for Visual C++ runtimes, legacy DirectX components, OpenAL, .NET Framework, XNA, and bundled repair installers.
- Distinguishes detected requirements from general recommendations and avoids presenting every bundled installer as required.
- Reports executable architecture and potential dependency mismatches.

### Performance Capture

- Adds bundled PresentMon-based frame capture for Windows.
- Reports average FPS, 1% low FPS, frame-time percentiles, spike frequency, and a condensed frame-time graph.
- Stores raw CSV captures locally.
- Adds per-game capture history, custom scene labels, scene-specific baselines, and automatic comparison labels for improvements or possible regressions.
- Includes PresentMon licensing information with the application.

### Game Configuration Validator

- Validates supported JSON, XML, and INI configuration files.
- Detects malformed structure, duplicate INI values, read-only files, and implausible graphics or display settings.
- Avoids displaying or uploading arbitrary configuration contents.

### Configuration Backup and Safe Reset

- Creates verified, per-game configuration backups.
- Safely renames current configuration files so the game can generate clean defaults.
- Creates a safety backup before reset or restore operations.
- Verifies backup hashes and rolls back earlier changes when an operation cannot complete safely.

### Launch Failure Analyzer

- Launches the current default profile while monitoring whether the expected game process appears and survives startup.
- Distinguishes immediate exits, early exits, missing processes, successful startup, and user cancellation.
- Correlates a failed launch with Crash Detective, Runtime Doctor, and Configuration Validator evidence.
- Stopping the monitor never closes the game.

### Mod Conflict and DLL Inspector

- Inventories DLLs, injectors, native plug-ins, and common mod frameworks.
- Recognizes BepInEx, MelonLoader, REFramework, UE4SS, ReShade, Special K, OptiScaler, Script Hook, RTX Remix, RenoDX, and ASI plug-ins.
- Checks mod-binary architecture, zero-byte files, proxy entry points, and differing duplicate DLL fingerprints.
- Provides a searchable inventory and direct access to file locations without modifying game files.

## Linux

### Cross-platform diagnostics

The core 2.4 diagnostic tools now include Linux-native implementations instead of simply hiding their Windows counterparts:

- **Crash Detective** reads existing `systemd-coredump` metadata and matches records against native or Proton game executables.
- **Display Validator** uses available KDE/KScreen, XRandR, and Linux DRM information to report active resolution, refresh rates, multi-monitor differences, and HDR state where the desktop exposes it.
- **Runtime and Dependency Doctor** inspects native ELF dependencies, launcher scripts, host library availability, Windows PE imports, Proton/Wine prefixes, and relevant repair tooling such as Protontricks.
- **Configuration Validator and Recovery** resolve native Linux and Proton configuration paths and provide the same validation, verified backup, Safe Reset, and restore safeguards.
- **Launch Failure Analyzer** monitors native processes and Proton/Wine process handoffs, then correlates early exits with Linux crash, runtime, and configuration evidence.
- **Mod Conflict and Binary Inspector** supports both Windows PE DLLs used by Proton games and native Linux shared objects, including architecture checks.
- **System Performance Diagnostics** report Linux CPU, memory, storage, graphics, Vulkan, GameMode, MangoHud, and Gamescope context where available.

### MangoHud performance capture

- Adds Linux performance capture using MangoHud logging and control interfaces.
- Uses the same history, scene labels, baselines, regression comparisons, graphs, and local CSV storage as the Windows capture workflow.
- Minimizes GameAtlas while capturing so the game can continue rendering, then restores the application after MangoHud finalizes the capture.
- Integrates with the existing per-game Linux Performance launch-option workflow.

### Background conflicts, Clean Launch, and shader cache

- Adds Linux-aware background-application and overlay detection.
- Extends Clean Launch with platform-appropriate process handling and restoration safeguards.
- Expands shader-cache discovery and cleanup for Linux, Steam, Proton, and graphics-driver cache locations while preserving confirmation and scope checks.

### GameAtlas Linux Mod Manager

GameAtlas 2.4 introduces a Linux-only managed mod workflow intended for players who cannot use the official Windows Vortex application.

- Uses a per-game staging library under `~/Games/VortexMods/<Game Name>/`.
- Imports local folders and ZIP, RAR, or 7z archives.
- Validates archives for unsafe paths, links, special files, excessive entry counts, excessive extracted size, and case-colliding paths.
- Provides a deployment preview before files are changed.
- Detects common archive wrappers and Unreal Engine `.pak` destinations.
- Supports multiple installed mods, enable/disable controls, priority ordering, and managed conflict resolution.
- Preserves payloads and overwritten files for reversible removal and repair.
- Supports purge, redeploy, verification, and repair operations.
- Adds named mod profiles.
- Stores mod name, version, author, source, notes, provenance, and deployment state.
- Supports transactional upgrades while preserving priority, enabled state, profiles, and recovery data.

### Nexus Mods testing integration

- Connects for the current session with a personal Nexus Mods API key.
- Looks up mod-page metadata and available files.
- Handles `nxm://` Mod Manager Download links and routes them to the selected game.
- Downloads eligible archives directly from a Nexus-provided HTTPS mirror into the staging library.
- Saves Nexus mod, file, version, and source provenance with managed deployments.
- Detects newer compatible Nexus files and guides transactional upgrades.
- Displays hourly and daily request quotas with low-quota protection and reset guidance.
- Keeps API keys and short-lived NXM credentials in memory rather than writing them to disk.

This Nexus connection remains a testing integration. A public release flow will require the Nexus-approved application authentication process. GameAtlas is an independent third-party application and is not affiliated with, endorsed by, or sponsored by Nexus Mods.

## Shared improvements

- Improved platform-aware game launching and local path resolution for native games and Proton/Wine installations.
- Expanded safety limits, validation, recovery behavior, and user-facing explanations around file-changing operations.
- Added clearer distinctions between observed evidence, possible contributors, and confirmed failures.
- Added an MIT license and a dedicated privacy notice covering local data, diagnostics, third-party connections, Nexus credentials, and retention.
- Updated application documentation for the expanded Windows and Linux feature set.

## Optional Linux dependencies

- **MangoHud** is required for Linux performance capture.
- **Gamescope** and **GameMode** remain optional performance tools.
- **`coredumpctl` / systemd-coredump** is required for Crash Detective to return system crash records.
- **KScreen, XRandR, or DRM display data** determines how much display and HDR information can be reported.
- **`lsar` and `unar`** are used for RAR and 7z archive inspection and extraction, including through the Bazzite host when available.
- **Protontricks** is optional and is reported as targeted repair tooling rather than run automatically.

GameAtlas reports missing optional tools when the corresponding feature is opened.

## Important notes and current limitations

- FOMOD installers and Nexus Collections are not supported by the Linux Mod Manager in 2.4.
- GameAtlas never automatically executes installers or scripts found inside downloaded mod archives.
- Windows users should continue using the official Vortex application for full Nexus mod-management support.
- Linux HDR visibility depends on the desktop compositor, display server, graphics stack, and information exposed by the host.
- Diagnostic findings identify evidence and likely contributors; they cannot guarantee that a reported item is the root cause.
- Close the game before restoring saves, resetting configuration, or deploying files the game may be using.

## Privacy

GameAtlas contains no advertising, analytics, or telemetry. Most analysis is performed locally. Network-backed features connect directly to their named services, and diagnostic data is never uploaded automatically. See `PRIVACY.md` for the complete privacy notice.
