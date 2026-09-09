import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getSettings,
} from "./settings";


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


function retentionCount() {
  return getSettings()
    .backupRetentionCount
    ?? 0;
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


export async function getBackupStorageSummary() {
  return invoke(
    "get_backup_storage_summary"
  );
}


export async function createSaveBackup(
  game,
  {
    backupType =
      "manual",
  } = {}
) {
  return invoke(
    "create_save_backup",
    {
      ...commonArgs(
        game
      ),

      retentionCount:
        retentionCount(),

      backupType:
        backupType ===
          "pre_launch"
          ? "pre_launch"
          : "backup",
    }
  );
}


export async function deleteSaveBackup(
  game,
  backupFileName
) {
  return invoke(
    "delete_save_backup",
    {
      ...commonArgs(
        game
      ),

      backupFileName,
    }
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

      retentionCount:
        retentionCount(),
    }
  );
}
