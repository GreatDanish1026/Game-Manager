# GameAtlas 2.0 — Linux Steam & Proton Discovery

This is Phase 2 of the GameAtlas 2.0 Linux work.

## What this package adds

A new Rust module:

```text
src-tauri/src/linux_steam.rs
```

and Tauri command:

```text
get_linux_steam_games
```

### Linux Steam discovery

The backend looks for common Steam installations including:

```text
~/.steam/steam
~/.local/share/Steam
~/.var/app/com.valvesoftware.Steam/data/Steam
```

The third location supports the common Flatpak Steam layout.

### Multiple Steam libraries

It reads:

```text
steamapps/libraryfolders.vdf
```

and scans each discovered Steam library.

### Installed games

It parses:

```text
steamapps/appmanifest_*.acf
```

and returns GameAtlas-friendly fields:

```text
id
name
store
launcherId
installPath
source
```

plus Linux-specific data:

```text
runtime
nativeLinux
proton
protonPrefix
compatibilityTool
steamLibraryPath
manifestPath
```

### Runtime classification

Current conservative classifications:

```text
native_linux
proton
windows_unknown
unknown
```

A game is strongly identified as Proton when a matching:

```text
steamapps/compatdata/<appid>/pfx
```

exists.

The scanner also uses ELF and `.exe` evidence to improve classification.

### Proton tool discovery

The backend inspects:

```text
Steam/config/config.vdf
```

for Steam's `CompatToolMapping`.

It also discovers installed compatibility tools under:

```text
steamapps/common/Proton*
compatibilitytools.d/*
```

including custom tools such as Proton-GE when present.

When a Proton game does not have an explicit per-game mapping, GameAtlas reports:

```text
Steam default / automatic
```

rather than guessing an exact Proton version.

## Important scope

This package deliberately does **not** merge Linux Steam games into the React library yet.

That is the next step after we confirm the Linux Rust backend is returning correct data on Bazzite.

Keeping discovery separate first makes debugging much easier and avoids risking the working Windows library.

## Apply on Windows development tree

Extract into the GameAtlas project root:

```powershell
powershell -ExecutionPolicy Bypass -File ".\GameAtlas_v2.0_Linux_Steam_Proton_Discovery\apply-linux-steam-proton.ps1"
```

The apply script preserves current Windows behavior and runs:

```powershell
npm run build
cargo check
```

Then confirm Windows still behaves normally:

```powershell
npm run tauri:dev
```

## Test on Bazzite

Use the same source tree on Bazzite.

The included:

```text
linux-steam-smoke-test.sh
```

can be run first:

```bash
bash ./GameAtlas_v2.0_Linux_Steam_Proton_Discovery/linux-steam-smoke-test.sh
```

Then run GameAtlas:

```bash
npm install
npm run tauri:dev
```

At this stage there is no UI for the new command yet.

For a direct backend inspection, the next integration package will wire this command into the existing `get_installed_games` flow and expose Linux runtime/Proton data to the game UI.

## Next package

**GameAtlas 2.0 — Linux Library Integration**

That will:

- merge Linux Steam games into the normal library
- preserve the existing Windows scanner
- carry `runtime`, `protonPrefix`, and `compatibilityTool` into the React game model
- add the first Linux/Proton status UI
