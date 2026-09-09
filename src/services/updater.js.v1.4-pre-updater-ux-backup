import {
  check,
} from "@tauri-apps/plugin-updater";

import {
  relaunch,
} from "@tauri-apps/plugin-process";

export async function checkForUpdates() {
  console.log(
    "[Updater] Checking for updates..."
  );

  const update =
    await check();

  if (!update) {
    console.log(
      "[Updater] Application is current"
    );

    return null;
  }

  console.log(
    "[Updater] Update found:",
    {
      version:
        update.version,

      date:
        update.date,

      body:
        update.body,
    }
  );

  return update;
}

export async function installUpdate(
  update,
  onProgress
) {
  let downloaded = 0;
  let contentLength = 0;

  await update.downloadAndInstall(
    (event) => {
      switch (
        event.event
      ) {
        case "Started":
          contentLength =
            event.data
              .contentLength ??
            0;

          if (onProgress) {
            onProgress({
              state:
                "started",

              downloaded: 0,

              total:
                contentLength,
            });
          }

          break;

        case "Progress":
          downloaded +=
            event.data
              .chunkLength;

          if (onProgress) {
            onProgress({
              state:
                "downloading",

              downloaded,

              total:
                contentLength,
            });
          }

          break;

        case "Finished":
          if (onProgress) {
            onProgress({
              state:
                "finished",

              downloaded,

              total:
                contentLength,
            });
          }

          break;

        default:
          break;
      }
    }
  );

  console.log(
    "[Updater] Update installed"
  );

  await relaunch();
}