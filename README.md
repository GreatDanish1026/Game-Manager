# GameAtlas

GameAtlas is a cross-platform desktop companion for PC gaming on **Windows and Linux**.

It combines game discovery, system information, compatibility resources, save management, modding integrations, performance diagnostics, controller information, and troubleshooting tools in one application.

Instead of jumping between launchers, PCGamingWiki, modding sites, save folders, driver tools, and system utilities, GameAtlas brings the most useful information together around the game you are actually playing.

---

## Features

### Unified Game Library

GameAtlas automatically detects installed games from supported launchers and combines them into one library.

#### Windows

Supported sources include:

- Steam
- Epic Games Launcher
- GOG Galaxy
- Ubisoft Connect
- EA App
- Xbox / Microsoft Store
- Manually added games

#### Linux

Supported sources include:

- Steam
- Heroic Games Launcher
- Lutris
- Native Linux games
- Proton/Wine games discovered through supported launchers
- Manually added games

GameAtlas supports multiple game libraries and secondary drives.

---

## Game Information

Selecting a game gives you a central view of useful local and external information.

Depending on the title, GameAtlas can show:

- Cover artwork
- Install location
- Main executable
- Game version
- Launcher / installation source
- PCGamingWiki information
- RenoDX support
- Vortex support
- Save locations
- Configuration locations
- Performance diagnostics
- Hardware context

---

## PCGamingWiki Integration

GameAtlas integrates PCGamingWiki information directly into the selected game experience.

This can help surface:

- Save locations
- Configuration file locations
- Known issues
- Fixes and workarounds
- Graphics information
- Input information
- Compatibility notes

---

## RenoDX Detection

GameAtlas can detect whether a game has a supported RenoDX implementation.

When support is found, GameAtlas provides direct access to the relevant RenoDX resource.

This is especially useful for games with community improvements related to:

- HDR
- Tonemapping
- Color presentation
- Rendering behavior

---

## Vortex Support Detection

GameAtlas can determine whether a game has a supported Vortex extension.

This makes it easier to identify titles that can be managed through the Vortex / Nexus Mods ecosystem without manually searching for an extension.

---

## Save Management

GameAtlas includes save-management tools for supported games.

Features can include:

- Save-location detection
- Backup
- Restore
- Save snapshots
- Configuration-file discovery
- Access to related game data

Save handling supports both conventional Windows locations and Linux environments such as Proton and Wine prefixes where available.

---

## Clean Launch

Clean Launch helps identify background applications that may interfere with gameplay, benchmarking, or troubleshooting.

GameAtlas can surface software such as:

- Overlays
- Recording tools
- Monitoring utilities
- Communication applications
- GPU overlays
- Launcher-related background software

A detected process is not automatically a problem. Clean Launch is designed to help narrow down possible conflicts.

---

## Shader Cache Management

GameAtlas includes shader-cache tools for troubleshooting graphical and performance problems.

Depending on the platform and hardware, GameAtlas can help surface relevant cache information for:

- NVIDIA
- AMD
- Intel
- DirectX
- Steam
- Mesa
- Linux graphics runtimes

Shader cache clearing is intended as a troubleshooting tool rather than routine maintenance.

---

## Performance Diagnostics

GameAtlas can help identify likely causes of common PC gaming performance issues.

Diagnostic areas include:

- Shader compilation
- CPU bottlenecks
- GPU bottlenecks
- VRAM pressure
- Memory pressure
- Storage bottlenecks
- Overlay conflicts
- Refresh-rate mismatches
- V-Sync issues
- Wrong-GPU usage
- Driver-related problems

The goal is to provide useful context and practical next steps rather than only displaying raw hardware information.

---

## Hardware Detection

GameAtlas detects gaming-relevant system hardware, including:

- CPU
- GPU
- Memory
- Storage
- Displays
- Refresh rate
- Connected controllers
- Operating system

Hardware information is used throughout performance diagnostics and platform-specific tools.

---

## Controller Detection

GameAtlas can detect connected controllers and surface them as part of the system information experience.

This helps determine whether a controller problem originates at the operating-system level or later in the input stack.

Controller troubleshooting can involve:

- Steam Input
- XInput
- DirectInput
- SDL
- Virtual controllers
- Proton / Wine

---

# Windows

GameAtlas includes Windows-specific support for:

- Steam
- Epic Games Launcher
- GOG Galaxy
- Ubisoft Connect
- EA App
- Xbox / Microsoft Store
- Executable version detection
- Windows hardware inspection
- Save management
- Shader cache management
- Clean Launch
- Performance diagnostics
- Graphics driver diagnostics
- Controller detection
- Multi-GPU systems

Windows-specific APIs and metadata are used where they provide useful information.

---

# Linux

GameAtlas supports modern Linux gaming environments, including gaming-focused distributions such as **Bazzite**.

Linux functionality includes:

- Steam game detection
- Proton game detection
- Heroic Games Launcher
- Lutris
- Native Linux games
- Manual game addition
- Hardware detection
- Controller detection
- Save and configuration workflows
- Performance diagnostics
- Proton / Wine context
- Linux gaming performance controls

Linux performance work includes integration or surfacing of tools such as:

- MangoHud
- FPS limiting
- Runtime performance controls
- Proton-aware configuration

GameAtlas aims for functional parity between Windows and Linux while using the tools that make sense on each platform.

---

## Manual Game Addition

Games that are not discovered automatically can be added manually.

Manual entries are useful for:

- Standalone games
- Portable games
- Unsupported launchers
- Source ports
- Fan games
- Custom installations
- Unusual executable layouts

---

## Cross-Platform Design

GameAtlas uses a shared user experience across Windows and Linux while keeping platform-specific implementations where necessary.

For example:

### Windows

GameAtlas can use:

- Registry information
- Windows executable metadata
- Windows process inspection
- Windows driver information
- Microsoft Store package data

### Linux

GameAtlas can use:

- Proton / Wine context
- Steam compatibility data
- Heroic and Lutris configuration
- Linux hardware information
- Vulkan-related tooling
- MangoHud and Linux performance utilities

---

# Documentation

Detailed documentation is available in the GameAtlas Wiki.

The wiki includes:

- Getting Started
- Windows installation
- Linux installation
- Game detection
- Supported launchers
- Feature documentation
- PCGamingWiki integration
- RenoDX
- Vortex
- Save management
- Clean Launch
- Shader cache management
- Performance diagnostics
- Controller detection
- Hardware detection
- Troubleshooting
- FAQ
- Roadmap
- Contributing

See the repository **Wiki** for full documentation.

---

# Current Development

GameAtlas is under active development.

Current work is focused on:

- Windows diagnostics
- Shader cache management
- Graphics driver diagnostics
- Linux feature parity
- Linux performance tooling
- Controller diagnostics
- Save/configuration workflows
- UI polish
- Reliability improvements

See the Wiki [[Roadmap]] page for more detail.

---

# Installation

Installation packages and release information are available through the GitHub Releases page.

Platform-specific installation instructions are documented in the Wiki.

---

# Development

GameAtlas is built using:

- Rust
- Tauri
- Web frontend technologies

Clone the repository:

```bash
git clone https://github.com/GreatDanish1026/Game-Manager.git
