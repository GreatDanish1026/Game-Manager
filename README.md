# GameAtlas

**GameAtlas** is a cross-platform desktop app for managing, inspecting, and understanding your installed PC game library.

It brings games from multiple launchers into one library, enriches them with PCGamingWiki data, and adds local tools for launching, modding, storage, screenshots, saves, installation health, and system information.

## Supported Game Sources

GameAtlas is not limited to Steam. Detection depends on the operating system.

### Windows

GameAtlas can automatically detect installed games from:

- **Steam**
- **Epic Games Launcher**
- **GOG Galaxy**
- **Ubisoft Connect**
- **EA App**
- **Xbox / Microsoft Store**

Supported games can be launched directly from GameAtlas using the appropriate launcher or platform integration.

### Linux

GameAtlas can discover installed games from:

- **Steam for Linux**
- **Heroic Games Launcher** — including supported Epic and GOG installations managed through Heroic
- **Lutris**

Linux discovery results are merged into the same GameAtlas library, so games from different sources can be managed together.

Games that cannot be detected automatically can also be added manually.

## Features

### Unified Game Library

- Multi-launcher game detection
- Searchable library
- Favorites and custom tags
- Hidden games
- Saved views and advanced filters
- Manual game entries
- Per-launcher rescans

### PCGamingWiki Integration

For matched games, GameAtlas can surface useful PC-specific information such as:

- HDR, ray tracing, upscaling, and frame generation support
- Controller and accessibility information
- Engine and graphics API details
- Save and configuration locations
- Essential improvements
- Known issues and fixes
- Cover artwork and game metadata

### Mods & Enhancements

GameAtlas combines enhancement and modding information into a single view, including support or local evidence for tools such as:

- **RenoDX**
- **Luma Framework**
- **Vortex Mod Manager**
- **Fluffy Mod Manager**
- **ReShade**
- **Special K**
- Cheat Engine tables and other detected local tools

### External Tools & Launch Hub

Per-game actions can include:

- Play Game
- Open Mod Manager
- Open Install Folder
- Open Config Folder
- Open Save Folder
- Open detected external tools

### Launch Profiles

Games can use multiple launch profiles, including:

- **Normal**
- **Modded**
- **Benchmark**
- Custom profiles

Profiles can use the standard launcher or a direct executable with custom arguments and working directories. Any profile can be selected as the default launch method for a game.

### Local Technical Inspection

GameAtlas can inspect installed files and report locally detected information such as:

- Main executable and architecture
- 32-bit / 64-bit information
- Game engine evidence
- Graphics API evidence
- Anti-cheat evidence
- DRM / platform integration
- Graphics DLLs
- ReShade and mod-manager evidence

### Storage & Installation Details

Per-game storage information can include:

- Installed size
- Install drive
- Free and total drive space
- Executable size
- Save-data size
- Config-data size
- Largest installed files

### Screenshot Browser

GameAtlas can locate Steam screenshots and common local screenshot folders, showing information such as screenshot count, newest screenshot, date, and folder location.

### Save Backup & Restore

GameAtlas can create and restore per-game save backups with:

- Timestamped backup history
- Optional notes
- Per-game backup retention
- Restore safety backups
- Optional automatic backup before launching a game

### Installation Health

GameAtlas can summarize the local state of a game using information it can verify, including installation paths, executables, saves, configuration, PCGamingWiki data, and detected enhancements.

### System Awareness

GameAtlas adapts to the system it is running on and can surface platform and hardware information, including operating system and GPU detection where available.

## Cross-Platform

GameAtlas is being developed for both **Windows** and **Linux**. Platform-specific integrations differ where the underlying launchers and game-installation systems differ.

## Technology

GameAtlas is built with:

- **Rust**
- **Tauri 2**
- **React**
- **Vite**
- **Tailwind CSS**

## Project Status

GameAtlas is under active development. Features and supported integrations continue to expand as the application evolves.

## Data Sources & Third-Party Services

GameAtlas uses information from third-party services such as [PCGamingWiki](https://www.pcgamingwiki.com/). Availability of individual fields varies by game.

GameAtlas is not affiliated with Valve, Epic Games, GOG, Ubisoft, Electronic Arts, Microsoft, PCGamingWiki, Nexus Mods, Vortex, RenoDX, or the developers of other detected third-party tools.

## License

See the repository license for details.
