import {
  invoke,
} from "@tauri-apps/api/core";

import {
  inspectLocalInstallation,
} from "./localInstallation";

import {
  getLaunchProfileState,
} from "./launchProfiles";


async function monitoredExecutable(
  game
) {
  const state =
    getLaunchProfileState(
      game
    );

  const profile =
    state.profiles.find(
      (entry) =>
        entry.id
          === state.defaultProfileId
    )
    ?? state.profiles[0];

  if (
    profile?.launchMode
      === "direct"
    && profile.executablePath
      ?.trim()
  ) {
    return profile.executablePath
      .trim();
  }

  const local =
    await inspectLocalInstallation(
      game
    );

  const executablePath =
    local?.executable
      ?.path;

  if (!executablePath) {
    throw new Error(
      "GameAtlas could not identify this game's primary executable. Check the local installation or use a direct launch profile."
    );
  }

  return executablePath;
}


export async function monitorGameLaunch(
  game
) {
  return invoke(
    "monitor_game_launch",
    {
      executablePath:
        await monitoredExecutable(
          game
        ),
    }
  );
}


export async function cancelLaunchFailureMonitor() {
  return invoke(
    "cancel_launch_failure_monitor"
  );
}
