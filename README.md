# GameAtlas

**GameAtlas** is a Windows desktop app for managing, inspecting, and understanding your installed PC game library.

It scans supported launchers, matches games with PCGamingWiki data, and brings technical details, mod support, local tools, storage information, screenshots, save tools, and launcher actions into one place.

## Highlights

- Detects games from Steam, Epic, GOG, Ubisoft Connect, EA App, and Xbox / Microsoft Store
- PCGamingWiki integration for game features, paths, fixes, and technical information
- Local installation inspection for executables, graphics technologies, ReShade, mod-manager evidence, and installation health
- External Tools & Launch Hub for Vortex, Fluffy Mod Manager, ReShade, Special K, and other detected tools
- Engine, graphics API, executable architecture, anti-cheat, and DRM / platform-integration details
- Storage details including install size, drive usage, save/config size, and largest installed files
- Screenshot Browser with Steam screenshot detection, newest screenshot, and quick folder access
- Mod Dashboard for RenoDX, Luma, Vortex, Fluffy, ReShade, Special K, and local mod evidence
- Save backup and restore tools
- Favorites, tags, personalization, diagnostics, and signed in-app updates

## Platform

GameAtlas supports **Windows** and **Linux**. Linux 2.0 support is focused on Steam, Heroic (Epic/GOG), and Lutris, including Proton-aware paths and save tools.

## Install

Download the latest installer from the GitHub **Releases** page.

GameAtlas includes signed automatic updates, so future releases can be installed from inside the app.

## Development

Built with:

- Rust
- Tauri 2
- React
- Vite
- Tailwind CSS

Run the development build:

```powershell
npm install
npm run tauri:dev
```

Build a release:

```powershell
npm run tauri:build
```

## Project Status

GameAtlas is actively developed. Current work focuses on improving game-level management, local analysis, launcher support, and PC gaming utilities.
