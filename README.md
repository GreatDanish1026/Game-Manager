# GameAtlas

GameAtlas is an open-source desktop companion for managing, inspecting, optimizing, and troubleshooting PC games on **Windows and Linux**.

It combines game discovery, system and compatibility information, save management, launch tools, diagnostics, performance capture, and platform-appropriate mod-management workflows in one application.

> GameAtlas 2.4 is under active development. The Linux mod manager and Nexus Mods connection are currently testing integrations.

[Releases](https://github.com/GreatDanish1026/Game-Manager/releases) · [Wiki](https://github.com/GreatDanish1026/Game-Manager/wiki) · [Privacy](PRIVACY.md) · [License](LICENSE)

## Highlights

- Unified installed-game library across supported launchers.
- Windows-native and Linux/Proton-aware inspection and diagnostics.
- PCGamingWiki metadata, known issues, paths, and compatibility resources.
- Save discovery, backup, restore, and snapshot workflows.
- Hardware, graphics-driver, display, controller, runtime, and installation analysis.
- Clean Launch, background-conflict detection, launch-failure analysis, and shader-cache tools.
- Game-specific configuration validation and mod-conflict inspection.
- Performance capture with PresentMon on Windows and MangoHud on Linux.
- Signed in-app application updates.

## Supported game sources

### Windows

- Steam
- Epic Games Launcher
- GOG Galaxy
- Ubisoft Connect
- EA App
- Xbox / Microsoft Store
- Manually added games

### Linux

- Steam, including Proton titles and secondary libraries
- Heroic Games Launcher
- Lutris
- Native Linux games
- Manually added games

Detection depends on the launcher and game exposing usable local installation metadata.

## Game information and local tools

Selecting a game provides a central view of available information and actions, which can include:

- Installation location, executable, architecture, engine, graphics API, and version.
- Launcher, anti-cheat, DRM, and platform-integration context.
- PCGamingWiki details, known issues, fixes, and external resources.
- RenoDX, Luma, ReShade, Fluffy Mod Manager, and Vortex support information.
- Save and configuration locations.
- Storage usage and large-file inspection.
- Screenshots, personal ratings, notes, tags, favorites, and play status.
- Launch profiles and game-specific compatibility settings.

## Diagnostics and maintenance

GameAtlas provides a coordinated Diagnostics Center and focused tools for:

- Display and refresh-rate validation.
- Crash and launch-failure investigation.
- Runtime dependency checks.
- Configuration validation and repair workflows.
- Mod conflicts and DLL inspection.
- Background application and overlay conflicts.
- Graphics-driver, shader-cache, CPU, GPU, VRAM, memory, and storage issues.
- Controller conflicts and input-stack context.
- Proton runtime, prefix, and compatibility troubleshooting on Linux.

Diagnostic findings are guidance rather than a guarantee that a detected item is the cause of a problem. Destructive or reversible maintenance actions are presented separately from read-only analysis.

## Performance capture

GameAtlas can record presented-frame data for repeatable comparisons, including average FPS, low-percentile performance, frame-time percentiles, and large spikes.

- Windows capture uses PresentMon.
- Linux capture uses MangoHud and requires the game to be launched with compatible MangoHud logging and control options.

Raw captures remain local and can be reviewed alongside the generated analysis.

## Save and configuration management

Supported workflows include:

- Save-location and configuration-location discovery.
- Backups, restore points, and snapshots.
- Proton/Wine path resolution where available.
- Configuration validation with preview and recovery safeguards.

Always close a game before restoring saves or changing files it may be using.

## Linux mod manager

GameAtlas 2.4 includes a Linux-only managed mod library for users who cannot use the official Windows Vortex application.

For each game, GameAtlas creates or uses a staging directory under:

```text
~/Games/VortexMods/<Game Name>/
```

Current capabilities include:

- Local folder, ZIP, RAR, and 7z staging.
- Safe extraction with path, link, special-file, entry-count, size, and case-collision checks.
- Deployment preview and Unreal Engine `.pak` destination handling.
- Multiple managed mods with enable/disable controls.
- Priority ordering and managed conflict resolution.
- Reversible installation with payload and overwritten-file backups.
- Purge, redeploy, verify, and repair operations.
- Named mod profiles.
- Mod metadata, source tracking, and transactional upgrades.

RAR and 7z extraction relies on detected `lsar`/`unar` support. GameAtlas does not execute installers or scripts from downloaded archives. Review every deployment preview and confirm that its layout matches the mod author's instructions.

FOMOD installers and Nexus Collections are not currently supported.

### Nexus Mods connection

The testing integration supports:

- Session-only connection with a personal Nexus Mods API key.
- Mod-page metadata and file-catalog lookup.
- `nxm://` Mod Manager Download links.
- Direct eligible archive downloads into the selected game's staging folder.
- Nexus provenance saved with managed mods.
- Automatic update detection and guided download-and-upgrade actions.
- Hourly and daily quota display, low-quota protection, and reset guidance.

API keys and short-lived NXM credentials are held in memory and are not written to disk. See the [privacy notice](PRIVACY.md) for details.

GameAtlas is an independent third-party application and is not affiliated with, endorsed by, or sponsored by Nexus Mods. The personal-key interface is intended for development and approval testing; a public Nexus-approved connection flow will replace it before general distribution of the integration.

## Platform-specific behavior

### Windows

GameAtlas uses Windows APIs and local metadata where appropriate, including registry information, executable metadata, process inspection, display and driver data, Microsoft Store packages, and PresentMon performance capture. Windows users should continue to use the official Vortex application for full Nexus mod management.

### Linux

GameAtlas uses Linux-native and gaming-focused facilities such as Steam compatibility data, Proton/Wine prefixes, Vulkan tooling, MangoHud, Heroic and Lutris configuration, and local system interfaces. It is designed to work on conventional desktop distributions and gaming-focused systems such as Bazzite.

The shared interface aims for functional parity while retaining platform-specific implementations where required.

## Privacy and security

GameAtlas performs most processing locally and does not include advertising, analytics, or telemetry. Network-backed features connect directly to their named third-party services. Diagnostic exports are created locally and are never uploaded automatically.

Review [PRIVACY.md](PRIVACY.md) for the information GameAtlas reads, local data it creates, third-party connections, Nexus credential handling, retention, and support contact details.

## Installation

Installers, AppImages, signatures, checksums, and release notes are published on the [GitHub Releases page](https://github.com/GreatDanish1026/Game-Manager/releases) when a release is available.

Platform-specific installation and troubleshooting guidance is maintained in the [GameAtlas Wiki](https://github.com/GreatDanish1026/Game-Manager/wiki).

Some optional features require external tools, such as MangoHud for Linux performance capture or `lsar`/`unar` for RAR and 7z extraction. GameAtlas reports missing dependencies when the corresponding feature is opened.

## Development

GameAtlas is built with Rust, Tauri 2, React, Vite, and Tailwind CSS.

Prerequisites include a current Node.js/npm toolchain, Rust, and the platform dependencies required by Tauri.

```bash
git clone https://github.com/GreatDanish1026/Game-Manager.git
cd Game-Manager
npm install
npm run tauri:dev
```

Build the frontend:

```bash
npm run build
```

Build a platform package:

```bash
npm run tauri:build
```

The Linux signed-release workflow is implemented in `scripts/release.sh`.

## Roadmap

Planned mod-management work includes FOMOD installer support, Nexus Collections, and continued compatibility testing across games and archive layouts. Broader roadmap and feature documentation are available in the repository Wiki.

## License

GameAtlas is distributed under the [MIT License](LICENSE).

Third-party components and bundled tools remain subject to their respective licenses. PresentMon's license is included with its bundled binary.
