# GameAtlas 2.0.0 — Linux Release Checklist

## Build

- [ ] Enter `gameatlas-dev` Distrobox.
- [ ] Pull the final 2.0 source.
- [ ] Confirm `git status`.
- [ ] Run `build-linux-appimage.sh`.
- [ ] Build completes without errors.
- [ ] AppImage is created.
- [ ] SHA256SUMS.txt is created.
- [ ] Structural extraction validation passes.

## Runtime

Run:

```bash
./release/v2.0.0-linux/GameAtlas_2.0.0_x86_64.AppImage
```

Then validate:

- [ ] GameAtlas starts successfully.
- [ ] Full library scan succeeds.
- [ ] Steam entries appear.
- [ ] Heroic Epic/GOG entries appear.
- [ ] Lutris entries appear.
- [ ] Cover art appears.
- [ ] One Steam game launches.
- [ ] One Heroic game launches.
- [ ] One Lutris game launches.
- [ ] Proton configuration/save paths resolve.
- [ ] Save Browser works.
- [ ] Save Backup/Restore works.
- [ ] Launch Profiles work.
- [ ] GPU/OS information looks correct.

## Distribution

Expected Linux release asset:

```text
GameAtlas_2.0.0_x86_64.AppImage
```

For GitHub, users can run:

```bash
chmod +x GameAtlas_2.0.0_x86_64.AppImage
./GameAtlas_2.0.0_x86_64.AppImage
```

## Scope

Bottles and Heroic Amazon/Nile are not part of the validated 2.0 Linux scope.

Xbox / Microsoft Store remains Windows-only.

## Publication

Do not publish until both the Windows signed-release assets and this Linux
AppImage have passed final runtime validation.
