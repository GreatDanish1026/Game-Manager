import {
  invoke,
} from "@tauri-apps/api/core";

export async function getReShadeAddonInstallerInfo() {
  return invoke(
    "get_reshade_addon_installer_info"
  );
}

export async function downloadReShadeAddonInstaller() {
  return invoke(
    "download_reshade_addon_installer"
  );
}

export async function installReShadeAddonsDirectLinux({
  installerPath,
  game,
  readiness,
}) {
  if (!readiness?.executablePath) {
    throw new Error(
      "GameAtlas could not determine the game executable."
    );
  }

  return invoke(
    "install_reshade_addons_direct_linux",
    {
      installerPath,
      targetExecutable:
        readiness.executablePath,
      architecture:
        readiness?.architecture
        ?? "64-bit",
      graphicsApi:
        readiness?.graphicsApi
        ?? null,
      gameKey:
        String(
          game?.launcherId
          ?? game?.id
          ?? game?.name
          ?? "game"
        ),
    }
  );
}

export async function installReShadeAddonsForCurrentPlatform({
  installerPath,
  game,
  readiness,
}) {
  const userAgent =
    typeof navigator !== "undefined"
      ? String(navigator.userAgent ?? "").toLowerCase()
      : "";

  const platform =
    typeof navigator !== "undefined"
      ? String(navigator.platform ?? "").toLowerCase()
      : "";

  const isWindows =
    userAgent.includes("windows")
    || platform.startsWith("win");

  if (!isWindows) {
    return installReShadeAddonsDirectLinux({
      installerPath,
      game,
      readiness,
    });
  }

  const executablePath =
    readiness?.executablePath
    ?? null;

  if (!executablePath) {
    throw new Error(
      "GameAtlas could not determine the Windows game executable for ReShade installation."
    );
  }

  return invoke(
    "install_reshade_addons_windows",
    {
      installerPath,
      executablePath,
      graphicsApi:
        readiness?.graphicsApi
        ?? null,
    }
  );
}

