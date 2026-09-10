# GameAtlas 2.0 — Platform Foundation

This is the first GameAtlas 2.0 development package.

It intentionally does **not** rewrite the Windows backend.

## Adds

### `src-tauri/src/platform.rs`

A new shared host-platform model exposed through:

```text
get_platform_info
```

On Linux it reports:

- host platform
- architecture
- distro name/version
- kernel
- desktop environment
- Wayland/X11 session type where available
- whether GameAtlas is running inside Flatpak
- Bazzite detection
- Steam Deck / SteamOS detection
- initial platform capabilities

### Linux system hardware

`get_system_hardware` now has a Linux implementation instead of returning:

```text
System hardware detection is currently implemented for Windows.
```

Initial Linux detection uses:

- `/proc/cpuinfo` for CPU
- `/proc/meminfo` for RAM
- `/etc/os-release` for distro
- `nvidia-smi` for NVIDIA GPU name/VRAM when available
- `lspci` as a general GPU fallback

No new Rust crate dependency is required.

## Preserved

The existing Windows:

- library scanner
- launcher behavior
- hardware detector
- save tools
- local inspection
- updater
- Tauri identity

are not replaced by this package.

## Apply

Extract the package into the GameAtlas project root.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File ".\GameAtlas_v2.0_Platform_Foundation\apply-platform-foundation.ps1"
```

The script backs up modified files and runs:

```powershell
npm run build
cargo check
```

## Windows test

After it succeeds:

```powershell
npm run tauri:dev
```

Verify the existing Windows library and game screen still behave normally.

## Linux/Bazzite test

Copy or clone the same resulting source tree onto Bazzite.

Install the normal Tauri 2 Linux build prerequisites for that environment, then run:

```bash
npm install
npm run tauri:dev
```

At this stage GameAtlas will **not yet discover Linux Steam games**. That is Phase 2.

The point of this package is to prove that the application backend can recognize Linux and return real hardware/platform information without affecting Windows.

## Next package

**GameAtlas 2.0 — Linux Steam & Proton Discovery**

That package will implement Linux Steam library scanning, app manifests, Proton prefixes, and compatibility-tool detection.
