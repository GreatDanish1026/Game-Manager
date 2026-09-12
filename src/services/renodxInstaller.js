import { invoke } from "@tauri-apps/api/core";

function matchedName(game) {
  return game?.renodx?.renodx?.matchedName ?? game?.renodx?.matchedName ?? null;
}

function executableName(readiness) {
  const path = readiness?.executablePath;

  if (!path) {
    return null;
  }

  return String(path)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    ?? null;
}

export function getRenoDxPackageInfo(game, readiness) {
  return invoke("get_renodx_package_info", {
    gameName: game?.name ?? "Unknown Game",
    renodxMatchName: matchedName(game),
    executableName: executableName(readiness),
    architecture: readiness?.architecture ?? "64-bit",
  });
}

export function installRenoDxPackageLinux(
  game,
  readiness,
  selectedAssetName = null
) {
  if (!readiness?.binaryDirectory) {
    throw new Error("GameAtlas could not determine the RenoDX installation folder.");
  }

  return invoke("install_renodx_package_linux", {
    gameName: game?.name ?? "Unknown Game",
    renodxMatchName: matchedName(game),
    executableName: executableName(readiness),
    selectedAssetName,
    architecture: readiness?.architecture ?? "64-bit",
    binaryDirectory: readiness.binaryDirectory,
    gameKey: String(game?.launcherId ?? game?.id ?? game?.name ?? "game"),
  });
}

export async function uninstallRenoDxPackageLinux(
  game,
  readiness,
  packageInfo
) {
  const assetName =
    packageInfo?.assetName;

  if (!assetName) {
    throw new Error(
      "RenoDX asset name is unavailable; refresh the RenoDX package first."
    );
  }

  const binaryDirectory =
    readiness?.binaryDirectory;

  if (!binaryDirectory) {
    throw new Error(
      "RenoDX binary directory is unavailable."
    );
  }

  const rawGameKey =
    game?.id
    ?? game?.appId
    ?? game?.name
    ?? "unknown-game";

  const gameKey =
    String(rawGameKey)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      || "unknown-game";

  return invoke(
    "uninstall_renodx_package_linux",
    {
      assetName,
      binaryDirectory,
      gameKey,
    }
  );
}


function buildRenoDxBackupGameKey(
  game
) {
  const rawGameKey =
    game?.id
    ?? game?.appId
    ?? game?.name
    ?? "unknown-game";

  return (
    String(rawGameKey)
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
    || "unknown-game"
  );
}

export async function getLatestRenoDxBackup(
  game
) {
  return invoke(
    "get_latest_renodx_backup",
    {
      gameKey:
        buildRenoDxBackupGameKey(
          game
        ),
    }
  );
}

export async function restoreLatestRenoDxBackupLinux(
  game,
  readiness
) {
  const binaryDirectory =
    readiness?.binaryDirectory;

  if (!binaryDirectory) {
    throw new Error(
      "RenoDX binary directory is unavailable."
    );
  }

  return invoke(
    "restore_latest_renodx_backup_linux",
    {
      gameKey:
        buildRenoDxBackupGameKey(
          game
        ),

      binaryDirectory,

      currentAssetName:
        readiness?.renodxFiles?.[0]?.name
        ?? null,
    }
  );
}


export async function getRenoDxUpdateStatusLinux(
  game,
  readiness
) {
  const binaryDirectory =
    readiness?.binaryDirectory;

  if (!binaryDirectory) {
    throw new Error(
      "RenoDX binary directory is unavailable."
    );
  }

  return invoke(
    "get_renodx_update_status_linux",
    {
      gameName:
        game?.name
        ?? "",

      renodxMatchName:
        game?.renodx
          ?.renodx
          ?.matchedName
        ?? null,

      architecture:
        readiness?.architecture
        ?? "64-bit",

      binaryDirectory,

      installedAssetName:
        readiness?.renodxFiles?.[0]?.name
        ?? null,
    }
  );
}
