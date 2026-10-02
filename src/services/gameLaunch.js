import {
  invoke,
} from "@tauri-apps/api/core";

import {
  createSaveBackup,
  getGamePreLaunchBackupEnabled,
} from "./saveBackups";
import { reviewBeforeGameLaunch } from "./launchCleanup";


export async function launchGame(
  game,
  { skipPreLaunchReview = false } = {}
) {
  let preLaunchBackupCreated =
    false;

  const preLaunchBackupEnabled =
    getGamePreLaunchBackupEnabled(
      game
    );

  if (
    preLaunchBackupEnabled
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

  if (!skipPreLaunchReview) await reviewBeforeGameLaunch(game);

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
