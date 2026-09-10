# GameAtlas v2.0.0 — Final Validation Checklist

Complete this checklist before publishing 2.0.0.

## 1. Source and identity

- [ ] All intended 2.0 changes are committed.
- [ ] Temporary extracted patch-package folders are not staged.
- [ ] `git status` is clean before the final release build.
- [ ] `package.json` reports `2.0.0`.
- [ ] `package-lock.json` reports `2.0.0`, if applicable.
- [ ] `src-tauri/Cargo.toml` reports `2.0.0`.
- [ ] `src-tauri/tauri.conf.json` reports `2.0.0`.
- [ ] Product name remains `GameAtlas`.
- [ ] Tauri identifier remains `com.greatdanish.gamemanager`.
- [ ] Updater configuration still references `latest.json`.
- [ ] Updater public key remains configured.

## 2. Bazzite — library discovery

Test the full scan with all available validated launchers installed.

- [ ] Steam games appear.
- [ ] Native Linux Steam games are identified correctly.
- [ ] Proton Steam games are identified correctly.
- [ ] Heroic Epic games appear.
- [ ] Heroic GOG games appear with real game names, not numeric IDs.
- [ ] Lutris games appear.
- [ ] Heroic GOG cover art appears.
- [ ] Lutris cover art appears.
- [ ] Full scan performance is acceptable.
- [ ] Duplicate entries are not unexpectedly created.

## 3. Bazzite — launching

- [ ] Launch one Steam game.
- [ ] Launch one Heroic Epic or GOG game.
- [ ] Launch one Lutris game.
- [ ] Existing launcher-specific Wine/Proton configuration is respected.
- [ ] Launch failures produce useful errors rather than hanging.

## 4. Bazzite — PCGamingWiki paths

Use at least one Proton game with known PCGamingWiki config/save paths.

- [ ] Steam Play path is preferred where PCGamingWiki provides one.
- [ ] Windows fallback path resolves inside the Proton prefix when needed.
- [ ] Backslashes are normalized correctly.
- [ ] Open Configuration Location works.
- [ ] Open Save Location works.
- [ ] Native Linux game paths do not incorrectly resolve into Proton.

## 5. Bazzite — saves

- [ ] Save Browser resolves a Proton save path.
- [ ] Save Browser displays expected files.
- [ ] Save Browser Open Folder works.
- [ ] Create Save Backup succeeds.
- [ ] ZIP backup is non-empty.
- [ ] Restore succeeds.
- [ ] Pre-restore safety backup is created.
- [ ] Retention behavior still works.
- [ ] Pre-launch backup still works through Launch Profiles.

## 6. Bazzite — Launch Profiles

- [ ] Normal standard-launcher profile works.
- [ ] Native Linux direct executable/script works.
- [ ] Proton direct executable works with an exact runner.
- [ ] Custom Proton Override dropdown lists installed custom Proton/GE-Proton.
- [ ] Selected override persists after restart.
- [ ] Dark dropdown styling is readable.

## 7. Bazzite — inspection / hardware

- [ ] Native Linux executable inspection returns expected executable data.
- [ ] Proton/Windows executable inspection still works.
- [ ] CPU detected correctly.
- [ ] RAM detected correctly.
- [ ] OS label says Operating System, not Windows.
- [ ] Primary NVIDIA GPU detected.
- [ ] Additional GPU detection does not replace the primary incorrectly.

## 8. PCGamingWiki regression

This is important because platform-specific path work touched PCGamingWiki integration.

- [ ] Open several known PCGamingWiki-matched games.
- [ ] Cover art still appears where it appeared before 2.0.
- [ ] Engine/API data still appears.
- [ ] Controller information still appears.
- [ ] RenoDX/Vortex/Fluffy cards still populate as expected.
- [ ] Essential Improvements / PCGW match remains functional.

If PCGamingWiki cover extraction is unexpectedly missing, inspect the pre-platform-path backup rather than replacing `pcgamingwiki.rs` from an older package.

## 9. Per-launcher rescan

- [ ] Steam-specific rescan works.
- [ ] Heroic-specific rescan works if currently exposed.
- [ ] Lutris-specific rescan works if currently exposed.
- [ ] Full rescan always discovers all three Linux sources.

If a launcher-specific rescan is not exposed in the current UI, record it as a post-2.0 enhancement rather than blocking release if full rescan works reliably.

## 10. Windows regression

Boot Windows 11 and validate the existing experience before release.

- [ ] App starts normally.
- [ ] Steam scan works.
- [ ] Epic scan works.
- [ ] GOG Galaxy scan works.
- [ ] Ubisoft scan works.
- [ ] EA scan works.
- [ ] Xbox / Microsoft Store scan works.
- [ ] Steam launch works.
- [ ] One non-Steam launcher launch works.
- [ ] PCGamingWiki data loads.
- [ ] Cover art loads.
- [ ] Save Browser works.
- [ ] Save Backup/Restore works.
- [ ] Launch Profiles work.
- [ ] Existing preferences/persistence survive upgrade.

## 11. Build validation

On Bazzite development environment:

```bash
npm run build
cd src-tauri
cargo check
```

For the normal Distrobox dev launch:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri:dev
```

On Windows, run the existing release preflight tooling before preparing signed assets.

## 12. Signed release preparation

Do not change the existing updater identity or signing key.

Use the existing signed release workflow only after Linux and Windows regression checks pass.

Expected version:

```text
2.0.0
```

Expected tag:

```text
v2.0.0
```

- [ ] Signed Windows installer produced.
- [ ] Signature produced.
- [ ] `latest.json` reports `2.0.0`.
- [ ] Update URL points to the 2.0.0 release assets.
- [ ] Existing installed version successfully upgrades to 2.0.0.
- [ ] Fresh installation succeeds.

## 13. Publication

Publishing is a separate explicit step.

Do not publish 2.0.0 until all blocking checks above have passed.
