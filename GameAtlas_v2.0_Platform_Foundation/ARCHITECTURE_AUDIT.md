# GameAtlas 2.0 — Initial Backend Architecture Audit

Baseline: final GameAtlas v1.6 `src-tauri` tree supplied immediately before 2.0 development.

## Goal

GameAtlas 2.0 should support Windows and Linux from one codebase. The React frontend should consume stable Tauri commands and shared data models rather than containing platform-specific behavior.

## Current classification

### Mostly cross-platform / reusable core

These modules contain substantial logic that can remain shared:

- `pcgamingwiki.rs`
- `pcgw_issues.rs`
- `renodx.rs`
- `rhi.rs`
- `vortex.rs`
- `fluffy.rs`
- `steam_rating.rs`
- significant parts of `local_installation.rs`
- significant parts of `save_backups.rs`
- `local_paths.rs` already contains Windows/Linux/macOS file-opening branches

### Platform-aware but requires Linux expansion

- `local_paths.rs`
  - already opens via `explorer.exe`, `xdg-open`, or macOS `open`
  - Windows environment/path-variable expansion still needs Proton-aware translation

- `local_installation.rs`
  - directory walking and many evidence checks are reusable
  - PE executable metadata and Windows drive-space/path assumptions need platform adapters
  - Linux native ELF inspection and Proton context still need to be added

- `game_version.rs`
  - file fingerprint concepts are reusable
  - Windows ProductVersion/FileVersion querying needs a platform-specific implementation
  - Steam build ID remains useful on both Windows and Linux

- `diagnostics.rs` / `diagnostics_export.rs`
  - overall diagnostics model is reusable
  - application-data locations and system collection need Linux paths/commands

- `save_backups.rs` / `save_browser.rs`
  - backup semantics are reusable
  - save-path resolution must learn native Linux and Proton prefixes

- `launch_profiles.rs`
  - profile model is reusable
  - direct executable launching currently assumes Windows executables in important paths

### Windows-specific or Windows-first

- `installed_games.rs`
  - Windows registry/location discovery
  - non-Windows command currently returns an empty library
  - first major Linux target: Steam libraries and app manifests

- `ea_games.rs`
  - Windows EA App registry/filesystem integration
  - Linux strategy should later treat EA primarily as a runtime/launcher inside Proton or through third-party launchers rather than pretending the Windows EA App is native

- `xbox_games.rs`
  - Windows AppX/AUMID integration
  - should remain explicitly Windows-only on Linux

- `game_launcher.rs`
  - contains protocol registry checks, Windows launcher discovery, `cmd.exe`, PowerShell/AppX, AUMID, and Windows-specific launch behavior
  - needs a shared dispatcher with platform-specific launcher implementations

- `system_hardware.rs`
  - v1.6 implementation was Windows-only
  - Platform Foundation adds an initial Linux implementation

## Platform boundary for 2.0

The stable Tauri API should remain conceptually similar:

```text
get_platform_info
get_installed_games
get_system_hardware
launch_game
get_launcher_status
open_game_path
inspect_local_installation
inspect_game_version
```

Internally these will increasingly route through:

```text
platform/
  windows/
  linux/
```

The migration should happen subsystem-by-subsystem, not as one giant rewrite.

## Phase plan

### Phase 1 — Platform Foundation
- shared platform/capability model
- `get_platform_info`
- Linux distro/kernel/session discovery
- initial Linux CPU/RAM/GPU discovery
- preserve current Windows behavior

### Phase 2 — Linux Steam + Proton Discovery
- locate Steam roots on Linux
- parse `libraryfolders.vdf`
- parse `appmanifest_*.acf`
- distinguish native Linux vs Windows/Proton
- discover `compatdata/<appid>/pfx`
- discover configured compatibility tool / Proton version
- preserve Windows Steam scanner

### Phase 3 — Proton-Aware Paths
- translate PCGamingWiki Windows paths into the game prefix
- `%USERPROFILE%`
- `%APPDATA%`
- `%LOCALAPPDATA%`
- Documents
- Saved Games
- Steam userdata placeholders
- connect Save Browser / Save Backups / config opening

### Phase 4 — Linux Local Inspection
- ELF + PE awareness
- Vulkan/OpenGL/DXVK/VKD3D evidence
- native vs Proton executable selection
- Linux filesystem/storage reporting
- Linux-compatible mod evidence

### Phase 5 — Launching
- native Steam Linux launch
- Steam Proton launch
- custom Linux executable/script launch profiles
- environment-variable launch options
- prefix-aware tool launching

### Phase 6 — Compatibility UI
- Linux / Proton card
- runtime
- Proton version
- prefix
- compatibility signals
- anti-cheat status where reliable
- native Linux availability where reliable

### Later
- Heroic
- Lutris
- Bottles
- packaging/distribution (including Flatpak permission design)
