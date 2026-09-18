import {
  invoke,
} from "@tauri-apps/api/core";

import {
  inspectLocalInstallation,
} from "./localInstallation";


function executableCandidates(
  game,
  local
) {
  return [
    local?.executable
      ?.fileName,
    local?.executable
      ?.path,
    game?.executable,
    game?.executablePath,
    game?.launchExecutable,
  ]
    .filter(
      (value) =>
        typeof value === "string"
        && value.trim()
    )
    .filter(
      (
        value,
        index,
        values
      ) =>
        values.indexOf(
          value
        ) === index
    );
}


export async function getCrashDetectiveReport(
  game
) {
  let local =
    null;

  try {
    local =
      await inspectLocalInstallation(
        game
      );
  } catch {
    // The Windows event-log query can still use the game name.
  }

  return invoke(
    "get_crash_detective_report",
    {
      gameName:
        game?.name
        ?? "Unknown Game",

      executableNames:
        executableCandidates(
          game,
          local
        ),
    }
  );
}
