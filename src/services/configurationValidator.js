import {
  invoke,
} from "@tauri-apps/api/core";

import {
  inspectLocalInstallation,
} from "./localInstallation";


function protonPrefix(
  game
) {
  if (
    game?.protonPrefix
    || game?.winePrefix
    || game?.prefixPath
  ) {
    return game.protonPrefix
      ?? game.winePrefix
      ?? game.prefixPath;
  }

  if (
    game?.steamLibraryPath
    && game?.launcherId
  ) {
    return `${String(game.steamLibraryPath).replace(/\/$/, "")}/steamapps/compatdata/${game.launcherId}/pfx`;
  }

  return null;
}


export async function getConfigurationValidationReport(
  game
) {
  const local =
    await inspectLocalInstallation(
      game
    );

  return invoke(
    "get_game_configuration_validation_report",
    {
      installPath:
        local?.installPath
        ?? game?.installPath
        ?? "",

      configPath:
        game?.technical
          ?.configLocation
        ?? null,

      resolvedConfigPath:
        local?.storageDetails
          ?.configData
          ?.resolvedPath
        ?? null,

      protonPrefix:
        protonPrefix(
          game
        ),
    }
  );
}


async function recoveryArgs(
  game
) {
  const local =
    await inspectLocalInstallation(
      game
    );

  return {
    gameName:
      game?.name
      ?? "Unknown Game",

    gameId:
      game?.id == null
        ? null
        : String(
            game.id
          ),

    installPath:
      local?.installPath
      ?? game?.installPath
      ?? "",

    configPath:
      game?.technical
        ?.configLocation
      ?? null,

    resolvedConfigPath:
      local?.storageDetails
        ?.configData
        ?.resolvedPath
      ?? null,

    executablePath:
      local?.executable
        ?.path
      ?? null,

    protonPrefix:
      protonPrefix(
        game
      ),
  };
}


export async function getConfigurationBackupStatus(
  game
) {
  const args =
    await recoveryArgs(
      game
    );

  return invoke(
    "get_game_configuration_backup_status",
    {
      gameName:
        args.gameName,

      gameId:
        args.gameId,

      executablePath:
        args.executablePath,
    }
  );
}


export async function createConfigurationBackup(
  game
) {
  return invoke(
    "create_game_configuration_backup",
    await recoveryArgs(
      game
    )
  );
}


export async function safelyResetConfiguration(
  game
) {
  return invoke(
    "safely_reset_game_configuration",
    await recoveryArgs(
      game
    )
  );
}


export async function restoreConfigurationBackup(
  game,
  backupId
) {
  return invoke(
    "restore_game_configuration_backup",
    {
      ...await recoveryArgs(
        game
      ),

      backupId,
    }
  );
}
