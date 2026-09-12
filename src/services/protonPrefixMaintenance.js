import {
  invoke,
} from "@tauri-apps/api/core";


function gameKey(game) {
  return String(
    game?.launcherId
    ?? game?.id
    ?? game?.name
    ?? "game"
  );
}


export async function getPrefixMaintenanceInfo(
  game,
  prefixPath
) {
  return invoke(
    "get_prefix_maintenance_info",
    {
      prefixPath,
      gameKey:
        gameKey(
          game
        ),
    }
  );
}


export async function createPrefixBackup(
  game,
  prefixPath
) {
  return invoke(
    "create_prefix_backup",
    {
      prefixPath,
      gameKey:
        gameKey(
          game
        ),
    }
  );
}


export async function restorePrefixBackup(
  game,
  prefixPath,
  backupPath,
  confirmation
) {
  return invoke(
    "restore_prefix_backup",
    {
      prefixPath,
      gameKey:
        gameKey(
          game
        ),
      backupPath,
      confirmation,
    }
  );
}


export async function resetPrefix(
  game,
  prefixPath,
  confirmation
) {
  return invoke(
    "reset_prefix",
    {
      prefixPath,
      gameKey:
        gameKey(
          game
        ),
      confirmation,
    }
  );
}
