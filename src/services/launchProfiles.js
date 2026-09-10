import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getSettings,
} from "./settings";

import {
  createSaveBackup,
} from "./saveBackups";

import {
  launchGame,
} from "./gameLaunch";

import {
  recordLaunchActivity,
} from "./recentActivity";


const STORAGE_KEY =
  "game-manager-launch-profiles-v1";


function gameKey(
  game
) {
  if (game?.id) {
    return String(
      game.id
    );
  }

  const store =
    String(
      game?.store
      ?? "unknown"
    )
      .trim()
      .toLowerCase();

  const launcherId =
    String(
      game?.launcherId
      ?? ""
    )
      .trim();

  if (launcherId) {
    return `${store}:${launcherId}`;
  }

  return `${store}:${String(
    game?.name
    ?? "unknown-game"
  )
    .trim()
    .toLowerCase()}`;
}


function defaultProfiles() {
  return [
    {
      id:
        "normal",

      name:
        "Normal",

      launchMode:
        "launcher",

      executablePath:
        "",

      arguments:
        "",

      workingDirectory:
        "",

      customProtonPath:
        "",
    },

    {
      id:
        "modded",

      name:
        "Modded",

      launchMode:
        "direct",

      executablePath:
        "",

      arguments:
        "",

      workingDirectory:
        "",

      customProtonPath:
        "",
    },

    {
      id:
        "benchmark",

      name:
        "Benchmark",

      launchMode:
        "direct",

      executablePath:
        "",

      arguments:
        "",

      workingDirectory:
        "",

      customProtonPath:
        "",
    },
  ];
}


function normalizeProfile(
  value,
  fallback
) {
  return {
    id:
      String(
        value?.id
        ?? fallback?.id
        ?? crypto.randomUUID()
      ),

    name:
      String(
        value?.name
        ?? fallback?.name
        ?? "Custom"
      )
        .trim()
      || "Custom",

    launchMode:
      value?.launchMode
        === "direct"
        ? "direct"
        : "launcher",

    executablePath:
      String(
        value?.executablePath
        ?? ""
      ),

    arguments:
      String(
        value?.arguments
        ?? ""
      ),

    workingDirectory:
      String(
        value?.workingDirectory
        ?? ""
      ),

    customProtonPath:
      String(
        value?.customProtonPath
        ?? ""
      ),
  };
}


function readStore() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(
        raw
      );

    return parsed
      && typeof parsed
        === "object"
      && !Array.isArray(
        parsed
      )
        ? parsed
        : {};
  } catch {
    return {};
  }
}


function writeStore(
  value
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      value
    )
  );
}


export function getLaunchProfileState(
  game
) {
  const store =
    readStore();

  const key =
    gameKey(
      game
    );

  const saved =
    store[key];

  const defaults =
    defaultProfiles();

  if (
    !saved
    || !Array.isArray(
      saved.profiles
    )
  ) {
    return {
      defaultProfileId:
        "normal",

      profiles:
        defaults,
    };
  }

  const profiles =
    saved.profiles.length
      > 0
      ? saved.profiles.map(
          (
            profile,
            index
          ) =>
            normalizeProfile(
              profile,
              defaults[index]
            )
        )
      : defaults;

  const requestedDefault =
    String(
      saved.defaultProfileId
      ?? "normal"
    );

  const defaultProfileId =
    profiles.some(
      (profile) =>
        profile.id
          === requestedDefault
    )
      ? requestedDefault
      : profiles[0]?.id
        ?? "normal";

  return {
    defaultProfileId,
    profiles,
  };
}


export function saveLaunchProfileState(
  game,
  state
) {
  const store =
    readStore();

  const key =
    gameKey(
      game
    );

  const profiles =
    Array.isArray(
      state?.profiles
    )
      ? state.profiles.map(
          (
            profile
          ) =>
            normalizeProfile(
              profile
            )
        )
      : defaultProfiles();

  let defaultProfileId =
    String(
      state?.defaultProfileId
      ?? "normal"
    );

  if (
    !profiles.some(
      (profile) =>
        profile.id
          === defaultProfileId
    )
  ) {
    defaultProfileId =
      profiles[0]?.id
      ?? "normal";
  }

  store[key] = {
    defaultProfileId,
    profiles,
  };

  writeStore(
    store
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-launch-profiles-changed",
      {
        detail: {
          gameKey:
            key,
        },
      }
    )
  );

  return store[key];
}


export function resetLaunchProfiles(
  game
) {
  const store =
    readStore();

  const key =
    gameKey(
      game
    );

  delete store[key];

  writeStore(
    store
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-launch-profiles-changed",
      {
        detail: {
          gameKey:
            key,
        },
      }
    )
  );

  return getLaunchProfileState(
    game
  );
}


export function createLaunchProfile() {
  return {
    id:
      crypto.randomUUID(),

    name:
      "Custom",

    launchMode:
      "direct",

    executablePath:
      "",

    arguments:
      "",

    workingDirectory:
      "",

      customProtonPath:
        "",
  };
}


function splitArguments(
  input
) {
  const text =
    String(
      input
      ?? ""
    );

  const result =
    [];

  let current =
    "";

  let quote =
    null;

  let escaped =
    false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const character =
      text[index];

    if (escaped) {
      current +=
        character;

      escaped =
        false;

      continue;
    }

    if (
      character
        === "\\"
      && quote
        === '"'
    ) {
      const next =
        text[
          index + 1
        ];

      if (
        next === '"'
        || next === "\\"
      ) {
        escaped =
          true;

        continue;
      }
    }

    if (
      character
        === '"'
      || character
        === "'"
    ) {
      if (
        quote
          === character
      ) {
        quote =
          null;
      } else if (!quote) {
        quote =
          character;
      } else {
        current +=
          character;
      }

      continue;
    }

    if (
      /\s/.test(
        character
      )
      && !quote
    ) {
      if (
        current.length
          > 0
      ) {
        result.push(
          current
        );

        current =
          "";
      }

      continue;
    }

    current +=
      character;
  }

  if (quote) {
    throw new Error(
      "Launch arguments contain an unmatched quote."
    );
  }

  if (
    current.length
      > 0
  ) {
    result.push(
      current
    );
  }

  return result;
}


async function createPreLaunchBackupIfEnabled(
  game
) {
  const settings =
    getSettings();

  if (
    !settings.backupBeforeLaunch
    || !game?.technical
      ?.saveLocation
  ) {
    return false;
  }

  try {
    await createSaveBackup(
      game,
      {
        backupType:
          "pre_launch",
      }
    );

    return true;
  } catch (error) {
    throw new Error(
      `Pre-launch backup failed, so GameAtlas did not launch the game. ${String(
        error
      )}`
    );
  }
}


export async function launchConfiguredProfile(
  game,
  profile
) {
  const normalized =
    normalizeProfile(
      profile
    );

  if (
    normalized.launchMode
      === "launcher"
  ) {
    if (
      normalized.arguments
        .trim()
      || normalized
        .executablePath
        .trim()
      || normalized
        .workingDirectory
        .trim()
    ) {
      throw new Error(
        "Custom executable paths and arguments require Direct Executable mode. Standard Launcher mode uses the game's existing launcher configuration."
      );
    }

    const result =
      await launchGame(
        game
      );

    recordLaunchActivity(
      game,
      {
        profileName:
          normalized.name,

        launchMode:
          "launcher",

        method:
          result?.method
          ?? "launcher",
      }
    );

    return result;
  }

  const executablePath =
    normalized
      .executablePath
      .trim();

  if (!executablePath) {
    throw new Error(
      `The "${normalized.name}" profile needs an executable path before it can be launched.`
    );
  }

  const preLaunchBackupCreated =
    await createPreLaunchBackupIfEnabled(
      game
    );

  const result =
    await invoke(
      "launch_profile_executable",
      {
        executablePath,

        arguments:
          splitArguments(
            normalized.arguments
          ),

        workingDirectory:
          normalized
            .workingDirectory
            .trim()
          || null,

        protonPrefix:
          game?.protonPrefix
          ?? null,

        compatibilityTool:
          game?.compatibilityTool
          ?? null,

        customProtonPath:
          normalized
            .customProtonPath
            .trim()
          || null,
      }
    );

  if (
    preLaunchBackupCreated
  ) {
    return {
      ...result,

      message:
        `Pre-launch save backup created. ${
          result?.message
          ?? "Launch request sent successfully."
        }`,
    };
  }

  return result;
}


export async function launchDefaultProfile(
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
          === state
            .defaultProfileId
    )
    ?? state.profiles[0]
    ?? defaultProfiles()[0];

  return launchConfiguredProfile(
    game,
    profile
  );
}


export async function getInstalledProtonTools() {
  return invoke(
    "get_installed_proton_tools"
  );
}
