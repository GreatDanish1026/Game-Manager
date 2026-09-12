import {
  invoke,
} from "@tauri-apps/api/core";

function firstValue(...values) {
  return values.find(
    (value) =>
      typeof value === "string"
      && value.trim().length > 0
  )
    ?? null;
}

export async function getRenoDxReadiness(game) {
  const renodx =
    game?.renodx?.renodx
    ?? game?.renodx
    ?? {};

  return invoke(
    "get_renodx_readiness",
    {
      installPath:
        firstValue(
          game?.installPath,
          game?.install_path,
          game?.path
        ),

      executablePath:
        firstValue(
          game?.mainExecutablePath,
          game?.mainExecutable,
          game?.executablePath,
          game?.localInspection?.mainExecutablePath,
          game?.localInspection?.mainExecutable?.path
        ),

      graphicsApi:
        firstValue(
          game?.technical?.api,
          game?.graphicsApi,
          game?.localInspection?.graphicsApi
        ),

      renodxSupported:
        Boolean(
          renodx?.available
          ?? renodx?.found
          ?? false
        ),

      renodxMatchName:
        firstValue(
          renodx?.matchedName,
          game?.name
        ),

      renodxProviderStatus:
        firstValue(
          renodx?.status
        ),
    }
  );
}
