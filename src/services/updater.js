import {
  check,
} from "@tauri-apps/plugin-updater";

import {
  relaunch,
} from "@tauri-apps/plugin-process";

import {
  invoke,
} from "@tauri-apps/api/core";


const SKIPPED_UPDATE_STORAGE_KEY =
  "game-manager-updater-skipped-version-v1";


export function getSkippedUpdateVersion() {
  try {
    return localStorage.getItem(
      SKIPPED_UPDATE_STORAGE_KEY
    );
  } catch {
    return null;
  }
}


export function skipUpdateVersion(
  version
) {
  const normalized =
    String(
      version
      ?? ""
    )
      .trim();

  if (!normalized) {
    return;
  }

  try {
    localStorage.setItem(
      SKIPPED_UPDATE_STORAGE_KEY,
      normalized
    );

    window.dispatchEvent(
      new CustomEvent(
        "game-manager-updater-skip-changed",
        {
          detail: {
            version:
              normalized,
          },
        }
      )
    );
  } catch {
    // A storage failure should not prevent the user from dismissing an update.
  }
}


export function clearSkippedUpdateVersion() {
  try {
    localStorage.removeItem(
      SKIPPED_UPDATE_STORAGE_KEY
    );

    window.dispatchEvent(
      new CustomEvent(
        "game-manager-updater-skip-changed",
        {
          detail: {
            version:
              null,
          },
        }
      )
    );
  } catch {
    // Ignore unavailable storage.
  }
}


export async function checkForUpdates({
  includeSkipped = false,
} = {}) {
  console.log(
    "[Updater] Checking for updates..."
  );

  let versionStatus =
    null;

  try {
    versionStatus =
      await invoke(
        "get_updater_version_status"
      );
  } catch (metadataError) {
    // Keep the signed Tauri updater as a fallback if the metadata preflight
    // cannot run. This preserves update checks during transient service or
    // compatibility failures while avoiding false "latest" claims below.
    console.warn(
      "[Updater] Version metadata preflight failed:",
      metadataError
    );
  }

  if (
    versionStatus
    && versionStatus.relation
      !== "update_available"
  ) {
    console.log(
      "[Updater] No newer published release",
      versionStatus
    );

    return {
      available:
        false,

      update:
        null,

      skipped:
        false,

      skippedVersion:
        getSkippedUpdateVersion(),

      ...versionStatus,
    };
  }

  if (
    versionStatus
    && !versionStatus
      .platformAvailable
  ) {
    throw new Error(
      `GameAtlas ${versionStatus.latestVersion} is published, but no signed update is available for ${versionStatus.target}.`
    );
  }

  const update =
    await check();

  if (!update) {
    console.log(
      "[Updater] Application is current"
    );

    if (
      versionStatus
      ?.relation
      === "update_available"
    ) {
      throw new Error(
        `GameAtlas ${versionStatus.latestVersion} is published, but the signed updater could not load it for ${versionStatus.target}.`
      );
    }

    return {
      available:
        false,

      update:
        null,

      skipped:
        false,

      skippedVersion:
        getSkippedUpdateVersion(),

      relation:
        versionStatus
          ?.relation
        ?? "unknown",

      currentVersion:
        versionStatus
          ?.currentVersion
        ?? null,

      latestVersion:
        versionStatus
          ?.latestVersion
        ?? null,
    };
  }

  const skippedVersion =
    getSkippedUpdateVersion();

  const skipped =
    Boolean(
      skippedVersion
      && String(
        update.version
      ) === skippedVersion
    );

  console.log(
    "[Updater] Update found:",
    {
      version:
        update.version,

      date:
        update.date,

      body:
        update.body,

      skipped,
    }
  );

  if (
    skipped
    && !includeSkipped
  ) {
    return {
      available:
        false,

      update:
        null,

      skipped:
        true,

      skippedVersion,
    };
  }

  return {
    available:
      true,

    update,

    skipped,

    skippedVersion,

    relation:
      versionStatus
        ?.relation
      ?? "update_available",

    currentVersion:
      versionStatus
        ?.currentVersion
      ?? null,

    latestVersion:
      versionStatus
        ?.latestVersion
      ?? update.version,
  };
}


export async function installUpdate(
  update,
  onProgress
) {
  let downloaded =
    0;

  let contentLength =
    0;

  await update.downloadAndInstall(
    (event) => {
      switch (
        event.event
      ) {
        case "Started":
          contentLength =
            event.data
              ?.contentLength
            ?? 0;

          onProgress?.({
            state:
              "started",

            downloaded:
              0,

            total:
              contentLength,
          });

          break;

        case "Progress":
          downloaded +=
            event.data
              ?.chunkLength
            ?? 0;

          onProgress?.({
            state:
              "downloading",

            downloaded,

            total:
              contentLength,
          });

          break;

        case "Finished":
          onProgress?.({
            state:
              "installing",

            downloaded,

            total:
              contentLength,
          });

          break;

        default:
          break;
      }
    }
  );

  console.log(
    "[Updater] Update installed"
  );

  onProgress?.({
    state:
      "installed",

    downloaded,

    total:
      contentLength,
  });
}


export async function restartForUpdate() {
  await relaunch();
}
