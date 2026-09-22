# GameAtlas Privacy Notice

Effective date: September 22, 2026

GameAtlas is a locally installed, open-source desktop application for Windows and Linux. This notice explains what information GameAtlas reads, stores, and sends when you use its features.

## Summary

GameAtlas does not operate an advertising, analytics, telemetry, or user-tracking service. It does not sell personal information. Most processing occurs locally on your computer.

Some features contact third-party services to retrieve public game information, check for application updates, or perform a user-requested Nexus Mods action. Those connections are described below.

## Information processed locally

Depending on the features you use, GameAtlas may read:

- Installed-game names, identifiers, versions, executable paths, and installation folders.
- Launcher configuration and library information from Steam, Epic Games Launcher, GOG Galaxy, Ubisoft Connect, EA App, Xbox/Microsoft Store, Heroic Games Launcher, and Lutris.
- Proton and Wine prefix information.
- Operating-system, CPU, GPU, memory, storage, display, graphics-driver, controller, process, and runtime information used by diagnostics.
- Save-game and configuration locations selected or discovered for supported games.
- Game files, mod archives, logs, crash information, and configuration files when you explicitly use an inspection, validation, repair, backup, or mod-management feature.

This information is processed on the device. GameAtlas does not automatically upload your installed-game library, hardware inventory, saves, configuration files, or diagnostic results to a GameAtlas-operated server.

## Information stored locally

GameAtlas stores settings and feature state locally, which can include:

- Application preferences, hidden games, manual library entries, tags, ratings, notes, launch profiles, and recent activity.
- Cached public game metadata and artwork.
- Save backups and configuration backups created at your request.
- Performance capture files.
- Linux managed-mod metadata, extracted payloads, conflict state, deployment backups, profiles, and downloaded archives in the applicable GameAtlas data and `VortexMods` directories.
- Diagnostic reports or support bundles you explicitly export.

Operational output may contain game names, process names, or local filesystem paths. GameAtlas does not automatically transmit that output. Review an exported diagnostic bundle before sharing it because it can describe your system and installed software.

Removing GameAtlas may not automatically remove its application-data directory, backups, performance captures, or `VortexMods` staging folders. You can delete those local files when you no longer need them.

## Nexus Mods integration

During the testing phase, connecting a Nexus Mods account requires a personal API key supplied by the user.

- The API key is held only in GameAtlas process memory.
- It is sent directly from your device to the Nexus Mods API over HTTPS.
- GameAtlas does not write the key to disk or intentionally include it in logs or error messages.
- The key is cleared when you disconnect the account or exit GameAtlas.

An `nxm://` Mod Manager Download link can contain a short-lived Nexus download key, user identifier, and expiration time. GameAtlas keeps the complete link in process memory only until the download succeeds, you dismiss it, or the application exits. These credentials are not displayed or intentionally logged.

GameAtlas sends the minimum identifiers needed for the requested Nexus operation, such as a Nexus game domain, mod ID, file ID, and application name/version. Downloaded archives are obtained directly from a Nexus-provided HTTPS mirror and stored locally. Nexus Mods independently processes connection information and account activity under its own terms and privacy policy.

GameAtlas is an independent third-party application and is not affiliated with, endorsed by, or sponsored by Nexus Mods.

## Other network services

Features you use may connect directly to:

- PCGamingWiki for game metadata, compatibility information, known issues, and artwork.
- Steam for public community-review information.
- GitHub for GameAtlas update metadata and releases, and for public RenoDX or Luma project information and downloads.
- Nexus Mods for public Vortex-extension metadata and user-requested account, catalog, update, and download operations.
- ReShade for user-requested package information or downloads.
- Other websites only when you choose to open an external resource in your browser.

These services receive ordinary connection information such as your IP address and may process requests under their own privacy policies. GameAtlas does not control their practices.

## Diagnostics and support

Diagnostic collection and export are initiated by the user. Reports are created locally and are not automatically uploaded. If you share a report through GitHub, email, or another service, that service and the recipient will receive the information you choose to share.

## Security

GameAtlas uses HTTPS for supported remote API and download operations and applies validation and safety limits to supported mod archives. No software can guarantee absolute security. Keep GameAtlas updated, obtain builds from the official repository, and do not share API keys or unreviewed diagnostic bundles.

## Changes to this notice

This notice may be updated when GameAtlas adds services or changes how information is processed. Material changes will be recorded in the repository and reflected by the effective date above.

## Contact

Questions, privacy concerns, and security reports can be submitted through the [GameAtlas GitHub repository](https://github.com/GreatDanish1026/Game-Manager/issues).
