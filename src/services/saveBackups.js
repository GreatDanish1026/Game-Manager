import {
  invoke,
} from "@tauri-apps/api/core";


function commonArgs(
  game
) {
  return {
    gameName:
      game.name,

    gameId:
      game.id
      ?? null,

    savePath:
      game.technical
        ?.saveLocation,

    installPath:
      game.installPath
      ?? null,
  };
}


export async function getSaveBackupStatus(
  game
) {
  return invoke(
    "get_save_backup_status",
    commonArgs(
      game
    )
  );
}


export async function createSaveBackup(
  game
) {
  return invoke(
    "create_save_backup",
    commonArgs(
      game
    )
  );
}


export async function restoreSaveBackup(
  game,
  backupFileName
) {
  return invoke(
    "restore_save_backup",
    {
      ...commonArgs(
        game
      ),

      backupFileName,
    }
  );
}
