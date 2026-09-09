# GameAtlas

GameAtlas is a Windows desktop application for managing and inspecting installed PC games across multiple launchers.

It combines a unified game library with PCGamingWiki integration, local installation inspection, graphics technology detection, mod compatibility information, save backup and restore, hardware awareness, and signed automatic updates.

## Features

### Multi-Store Library

GameAtlas detects installed games from:

- Steam
- Epic Games
- GOG
- Ubisoft Connect

The library includes:

- duplicate filtering
- search
- sorting
- hidden games
- favorites
- custom tags
- advanced capability filters

### Library Overview

The Library Overview dashboard summarizes your installed game library, including:

- installed games
- analyzed games
- analysis coverage
- favorites
- storefront breakdown
- HDR support
- ray tracing support
- frame generation support
- ultrawide support
- RenoDX support
- Luma Framework support
- Vortex support
- Fluffy Mod Manager support

Capability statistics are based on games that GameAtlas has already analyzed, avoiding unnecessary bulk requests to external services.

### PCGamingWiki Integration

GameAtlas retrieves PCGamingWiki information for selected games, including:

- developer
- publisher
- release date
- game engine
- graphics API
- configuration file locations
- save game locations
- controller support
- HDR
- ray tracing
- ultrawide
- 4K
- high refresh rate support
- upscaling
- frame generation
- Essential Improvements
- Known Issues & Fixes

External links open through the native Tauri opener.

### Local Installation Inspector

GameAtlas can inspect the actual files in a game's installation directory.

The inspector can detect:

- likely primary executable
- executable architecture
- NVIDIA DLSS
- NVIDIA DLSS Frame Generation
- Intel XeSS
- AMD FidelityFX Super Resolution
- graphics DLL versions
- ReShade
- local Vortex evidence
- local Fluffy Mod Manager evidence

Scans are cached during the current session, with a manual Rescan option available when needed.

### Installation Health

Each game includes an Installation Health summary based on the information GameAtlas has been able to detect.

Checks can include:

- install path
- executable detection
- PCGamingWiki data
- configuration path
- save path
- save backup status
- HDR enhancement lookup
- local graphics technology inspection
- ReShade inspection

Health states include:

- Excellent
- Good
- Needs Attention
- Incomplete

The score represents setup completeness, not whether the game itself is broken or functioning correctly.

### Hardware Awareness

GameAtlas can detect basic Windows system information such as:

- CPU
- installed memory
- Windows version
- GPUs
- reported GPU memory

It also provides conservative hardware capability checks for features such as:

- hardware ray tracing
- NVIDIA DLSS
- NVIDIA DLSS Frame Generation
- Intel XeSS

GameAtlas does not attempt to predict FPS or benchmark performance.

### RenoDX and Luma Framework

GameAtlas checks selected games for HDR enhancement support through:

- RenoDX
- Luma Framework

Where available, GameAtlas can display compatibility status, source information, and relevant links.

### ReShade HDR Installer

GameAtlas can detect and launch ReShade HDR Installer when installed.

### Vortex Support

GameAtlas checks the official Vortex extension manifest to determine whether a selected game is supported.

Support can be reported as:

- built-in
- extension-based
- unsupported

### Fluffy Mod Manager

GameAtlas includes conservative compatibility detection for Fluffy Mod Manager and can also identify local installation evidence.

### Save Backup and Restore

GameAtlas can create and restore ZIP backups of supported save locations.

Features include:

- per-game backup storage
- timestamped backups
- newest-first history
- restore support
- automatic pre-restore safety backups

### Launch Games

Supported games can be launched directly from GameAtlas through their associated launcher.

Supported launchers include:

- Steam
- Epic Games
- GOG Galaxy
- Ubisoft Connect

### Favorites and Tags

Games can be marked as favorites and assigned custom tags.

Tags can also be used for searching and filtering.

### Advanced Filters

The game library can be filtered using technical and mod-related capabilities, including:

- HDR
- Ray Tracing
- Upscaling
- DLSS
- Frame Generation
- DLSS Frame Generation
- Ultrawide
- 4K
- 120+ FPS
- RenoDX
- Luma
- Vortex
- Fluffy

## Automatic Updates

GameAtlas includes signed Tauri updater support.

The application can:

- check for updates
- display release notes
- download new versions
- show download progress
- validate signed updater packages
- install updates
- report installation failures
- retry failed installations

Automatic startup update-check failures are silent so the app remains unobtrusive when offline.

Manual update checks are available from the Library Overview.

## Technology Stack

GameAtlas is built with:

- Rust
- Tauri 2
- React
- Vite
- Tailwind CSS

## Supported Platform

GameAtlas currently targets Windows.

Linux/Proton support may be explored in the future, but Windows is the primary supported platform for the current release.

## Installation

Download the latest Windows installer from the GitHub Releases page:

https://github.com/GreatDanish1026/Game-Manager/releases/latest

Run the installer and launch GameAtlas from Windows.

## Updating

GameAtlas can check for updates from inside the application.

You can also manually download the latest installer from:

https://github.com/GreatDanish1026/Game-Manager/releases/latest

## Building From Source

### Requirements

You will need:

- Node.js
- npm
- Rust
- Cargo
- Tauri 2 prerequisites for Windows
- Microsoft C++ Build Tools / Visual Studio Build Tools
- WebView2

### Clone the Repository

```powershell
git clone https://github.com/GreatDanish1026/Game-Manager.git
cd Game-Manager
```

### Install Dependencies

```powershell
npm install
```

### Run in Development Mode

```powershell
npm run tauri:dev
```

### Build the Frontend

```powershell
npm run build
```

### Check the Rust Backend

```powershell
cd src-tauri
cargo check
cd ..
```

### Build the Windows Application

```powershell
npm run tauri:build
```

The release executable is typically created under:

```text
src-tauri\target\release\
```

The NSIS installer is created under:

```text
src-tauri\target\release\bundle\nsis\
```

## Signed Updater Builds

Updater-enabled production builds require a Tauri updater signing key.

The private signing key must remain private and should never be committed to the repository.

Example environment setup in PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "$HOME\.tauri\game-manager.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "YOUR_PASSWORD"

npm run tauri:build
```

The updater public key belongs in `tauri.conf.json`.

Never commit:

- updater private keys
- updater passwords
- secrets containing signing material

## Release Assets

A production release uses:

```text
GameManager_<version>_x64-setup.exe
GameManager_<version>_x64-setup.exe.sig
latest.json
```

The `latest.json` file is used by the in-app updater.

## Current Release

**GameAtlas v1.0.0**

v1.0.0 is the first production-ready release and includes the full game library, PCGamingWiki, installation inspection, hardware awareness, mod compatibility, backup, dashboard, updater, and production-hardening feature set.

## Data and External Services

GameAtlas may retrieve information from external sources including:

- PCGamingWiki
- RenoDX
- Luma Framework
- Vortex extension data
- GitHub Releases

External-service failures are handled independently so the local game library remains usable if a service is unavailable.

## Disclaimer

GameAtlas is an independent project and is not affiliated with Valve, Epic Games, GOG, Ubisoft, PCGamingWiki, NVIDIA, AMD, Intel, Nexus Mods, RenoDX, Luma Framework, or any game publisher or platform referenced by the application.

All trademarks belong to their respective owners.

## License

See the repository license for terms of use.

## Repository

https://github.com/GreatDanish1026/Game-Manager
