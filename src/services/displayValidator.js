import {
  invoke,
} from "@tauri-apps/api/core";

import {
  inspectLocalInstallation,
} from "./localInstallation";


export async function getDisplayValidationReport(
  game
) {
  let executablePath =
    game?.executablePath
    ?? null;

  try {
    const local =
      await inspectLocalInstallation(
        game
      );

    executablePath =
      local?.executable
        ?.path
      ?? executablePath;
  } catch {
    // Display validation does not require a detected executable.
  }

  return invoke(
    "get_display_validation_report",
    {
      executablePath,
    }
  );
}
