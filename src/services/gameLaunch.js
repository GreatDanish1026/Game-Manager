import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getSettings,
} from "./settings";

import {
  createSaveBackup,
} from "./saveBackups";


export async function launchGame(
  game
) {
  const settings =
    getSettings();

  let preLaunchBackupCreated =
    false;

  if (
    settings.backupBeforeLaunch
    && game.technical
      ?.saveLocation
  ) {
    try {
      await createSaveBackup(
        game,
        {
          backupType:
            "pre_launch",
        }
      );

      preLaunchBackupCreated =
        true;
    } catch (error) {
      throw new Error(
        `Pre-launch backup failed, so GameAtlas did not launch the game. ${String(
          error
        )}`
      );
    }
  }

  const result =
    await invoke(
      "launch_game",
      {
        name:
          game.name,

        store:
          game.store,

        launcherId:
          game.launcherId
          ?? null,

        gameId:
          game.id
          ?? null,

        installPath:
          game.installPath
          ?? "",
      }
    );

  if (
    preLaunchBackupCreated
  ) {
    return {
      ...result,

      message:
        `Pre-launch save backup created. ${
          result?.message
          ?? "Launch request sent successfully."
        }`,
    };
  }

  return result;
}
