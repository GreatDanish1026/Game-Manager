# GameAtlas 2.0.0 — Linux Release Build Prep

This package creates the Linux install artifact for GameAtlas 2.0.0.

The primary Linux artifact is an **AppImage**, which is appropriate for the
initial Bazzite/Fedora-focused release because users can download one file,
mark it executable, and run it without installing an RPM.

## Target

Validated Linux 2.0 scope:

- Bazzite / Fedora-family Linux
- Steam
- Heroic Epic/GOG
- Lutris
- native Linux games
- Proton games

## Build environment

Run the Linux build inside the same Distrobox used for GameAtlas development:

```bash
distrobox enter gameatlas-dev
cd ~/Development/GameManager
```

## Build

Extract this package into the GameAtlas project root, then:

```bash
chmod +x ./GameAtlas_v2.0.0_Linux_Release_Build_Prep/build-linux-appimage.sh
./GameAtlas_v2.0.0_Linux_Release_Build_Prep/build-linux-appimage.sh
```

The script:

- validates version `2.0.0`
- validates `GameAtlas`
- protects `com.greatdanish.gamemanager`
- runs `npm run build`
- runs `cargo check`
- builds only the Tauri AppImage bundle
- copies the result to a clean release folder
- marks it executable
- creates SHA256SUMS.txt
- performs an AppImage extraction/structure check

Expected output:

```text
release/v2.0.0-linux/
  GameAtlas_2.0.0_x86_64.AppImage
  SHA256SUMS.txt
```

## Validate again

```bash
chmod +x ./GameAtlas_v2.0.0_Linux_Release_Build_Prep/validate-linux-release.sh
./GameAtlas_v2.0.0_Linux_Release_Build_Prep/validate-linux-release.sh
```

## Manual runtime test

On Bazzite:

```bash
./release/v2.0.0-linux/GameAtlas_2.0.0_x86_64.AppImage
```

If the WebKit/NVIDIA compositing workaround is needed:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 \
  ./release/v2.0.0-linux/GameAtlas_2.0.0_x86_64.AppImage
```

## Optional combined review folder

After you have also prepared the Windows release assets, on Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File ".\GameAtlas_v2.0.0_Linux_Release_Build_Prep\prepare-combined-review.ps1"
```

This copies the Linux AppImage and available Windows release assets into:

```text
release\v2.0.0-combined
```

for final review.

## Important

This package does **not**:

- publish a GitHub release
- create an RPM
- create a Flatpak
- alter the application identifier
- embed signing secrets

AppImage is the Linux installer/distribution format for this first 2.0 Linux
release. Flatpak can be added later once you want to maintain and test that
packaging path.
