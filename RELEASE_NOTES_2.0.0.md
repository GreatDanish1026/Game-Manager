# GameAtlas v2.0.0 — Linux Support

GameAtlas 2.0 introduces the first supported Linux experience while preserving the existing Windows application and upgrade identity.

## Linux launcher support

GameAtlas can discover and integrate installed games from:

- Steam
- Heroic Games Launcher — Epic
- Heroic Games Launcher — GOG
- Lutris

Linux library sources are merged into the same GameAtlas library used by the existing desktop experience.

## Steam & Proton

GameAtlas 2.0 adds Linux Steam library discovery and Proton awareness, including:

- multiple Steam library folders
- native Linux game detection
- Proton / Windows-runtime detection
- Proton prefix discovery
- installed Proton and custom compatibility tool awareness
- conservative handling of Steam automatic/default Proton selection
- fast bounded executable-header checks

Steam games launch through Steam so existing Steam compatibility settings remain authoritative.

## Proton-aware paths

PCGamingWiki configuration and save paths can now resolve into an exact Steam Proton prefix.

Supported mappings include common Windows locations such as:

- `%USERPROFILE%`
- `%APPDATA%`
- `%LOCALAPPDATA%`
- Documents
- Saved Games
- `C:\...`

Linux path separator handling is also normalized for PCGamingWiki values containing Windows separators.

## Save tools

Save Backups and Save Browser are Proton-aware.

Linux save backup support includes:

- ZIP backup creation
- ZIP restore
- retention
- pre-restore safety backups
- pre-launch backup compatibility

## Heroic

GameAtlas integrates Heroic-installed Epic and GOG games.

The integration includes:

- installed-game discovery
- correct GOG title metadata resolution
- Heroic/GOG cover artwork
- launch delegation back to Heroic

GameAtlas delegates launching to Heroic so the launcher remains authoritative for the selected Wine/Proton runner and per-game configuration.

## Lutris

GameAtlas integrates installed Lutris games, including:

- native and Flatpak Lutris detection
- Distrobox-to-host execution support
- game name, path, service and runner metadata
- cover art
- launch delegation through Lutris

Lutris discovery is optimized to use one detected backend, and Linux Steam/Heroic/Lutris scans run concurrently.

## Launch Profiles

Linux Launch Profiles support:

- standard launcher profiles
- native Linux direct executables/scripts
- Proton `.exe` profiles
- installed custom Proton / GE-Proton discovery
- per-profile custom Proton overrides

## Linux local inspection & hardware

GameAtlas 2.0 adds:

- native Linux executable / ELF inspection
- Linux CPU, memory and OS reporting
- Linux GPU detection with host fallback for Distrobox
- platform-neutral OS labels

## Scope

The validated Linux 2.0 launcher targets are Steam, Heroic Epic/GOG, and Lutris.

Bottles and Heroic Amazon/Nile support are intentionally not part of the validated 2.0 scope.

Xbox / Microsoft Store integration remains Windows-only.

## Windows continuity

GameAtlas 2.0 preserves the existing Windows code paths and keeps the existing Tauri application identifier:

```text
com.greatdanish.gamemanager
```

This identifier must remain unchanged so installed GameAtlas versions retain upgrade continuity.
