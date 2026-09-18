import {
  invoke,
} from "@tauri-apps/api/core";

import {
  inspectLocalInstallation,
} from "./localInstallation";


async function executablePath(
  game
) {
  const local =
    await inspectLocalInstallation(
      game
    );

  const path =
    local?.executable
      ?.path;

  if (!path) {
    throw new Error(
      "GameAtlas could not identify this game's primary executable."
    );
  }

  return path;
}


export async function getPerformanceCaptureStatus(
  game
) {
  let path =
    null;

  try {
    path =
      await executablePath(
        game
      );
  } catch {
    // The backend can still report provider availability.
  }

  return invoke(
    "get_performance_capture_status",
    {
      executablePath:
        path,
    }
  );
}


export async function runPerformanceCapture(
  game,
  durationSeconds
) {
  return invoke(
    "run_performance_capture",
    {
      executablePath:
        await executablePath(
          game
        ),

      durationSeconds,
    }
  );
}


export async function cancelPerformanceCapture() {
  return invoke(
    "cancel_performance_capture"
  );
}
