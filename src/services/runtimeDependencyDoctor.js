import {
  invoke,
} from "@tauri-apps/api/core";

import {
  inspectLocalInstallation,
} from "./localInstallation";


export async function getRuntimeDependencyReport(
  game
) {
  const local =
    await inspectLocalInstallation(
      game
    );

  const executablePath =
    local?.executable
      ?.path;

  if (!executablePath) {
    throw new Error(
      "GameAtlas could not identify this game's primary executable."
    );
  }

  return invoke(
    "get_runtime_dependency_report",
    {
      installPath:
        local?.installPath
        ?? game?.installPath
        ?? "",

      executablePath,

      architecture:
        local?.executable
          ?.architecture
        ?? null,
    }
  );
}
