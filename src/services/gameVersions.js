import {
  invoke,
} from "@tauri-apps/api/core";


const STORAGE_KEY =
  "game-manager-game-versions-v1";

const CHANGED_EVENT =
  "game-manager-game-versions-changed";


function loadAll() {
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
      && typeof parsed === "object"
      && !Array.isArray(parsed)
        ? parsed
        : {};
  } catch {
    return {};
  }
}


function saveAll(
  value
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      value
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      CHANGED_EVENT
    )
  );
}


function gameId(
  game
) {
  return String(
    game?.id
    ?? ""
  ).trim();
}


function cleanText(
  value
) {
  const text =
    String(
      value
      ?? ""
    ).trim();

  return text
    || null;
}


function getExecutablePath(
  game
) {
  const candidates = [
    game?.executablePath,
    game?.executable,
    game?.localInstallation
      ?.mainExecutable
      ?.path,
    game?.localInstallation
      ?.mainExecutablePath,
    game?.installation
      ?.mainExecutable
      ?.path,
    game?.technical
      ?.mainExecutablePath,
  ];

  for (
    const candidate
    of candidates
  ) {
    const value =
      cleanText(
        candidate
      );

    if (value) {
      return value;
    }
  }

  return null;
}


function normalizedSnapshot(
  snapshot
) {
  if (!snapshot) {
    return null;
  }

  return {
    checkedAt:
      cleanText(
        snapshot.checkedAt
      ),

    source:
      cleanText(
        snapshot.source
      ),

    productVersion:
      cleanText(
        snapshot.productVersion
      ),

    fileVersion:
      cleanText(
        snapshot.fileVersion
      ),

    steamBuildId:
      cleanText(
        snapshot.steamBuildId
      ),

    executablePath:
      cleanText(
        snapshot.executablePath
      ),

    executableModifiedAt:
      cleanText(
        snapshot.executableModifiedAt
      ),

    executableSize:
      Number.isFinite(
        Number(
          snapshot.executableSize
        )
      )
        ? Number(
            snapshot.executableSize
          )
        : null,
  };
}


function signature(
  snapshot
) {
  if (!snapshot) {
    return null;
  }

  return JSON.stringify({
    productVersion:
      snapshot.productVersion
      ?? null,

    fileVersion:
      snapshot.fileVersion
      ?? null,

    steamBuildId:
      snapshot.steamBuildId
      ?? null,

    executableModifiedAt:
      snapshot.executableModifiedAt
      ?? null,

    executableSize:
      snapshot.executableSize
      ?? null,
  });
}


export function getGameVersionState(
  game
) {
  const id =
    gameId(
      game
    );

  const empty = {
    manualVersion:
      "",

    current:
      null,

    history:
      [],
  };

  if (!id) {
    return empty;
  }

  const stored =
    loadAll()[id];

  if (
    !stored
    || typeof stored
      !== "object"
  ) {
    return empty;
  }

  return {
    manualVersion:
      cleanText(
        stored.manualVersion
      )
      ?? "",

    current:
      normalizedSnapshot(
        stored.current
      ),

    history:
      Array.isArray(
        stored.history
      )
        ? stored.history
            .map(
              normalizedSnapshot
            )
            .filter(
              Boolean
            )
        : [],
  };
}


export function setManualGameVersion(
  game,
  value
) {
  const id =
    gameId(
      game
    );

  if (!id) {
    return;
  }

  const all =
    loadAll();

  const current =
    getGameVersionState(
      game
    );

  all[id] = {
    ...current,

    manualVersion:
      cleanText(
        value
      )
      ?? "",
  };

  saveAll(
    all
  );
}


export function clearGameVersionHistory(
  game
) {
  const id =
    gameId(
      game
    );

  if (!id) {
    return;
  }

  const all =
    loadAll();

  const current =
    getGameVersionState(
      game
    );

  all[id] = {
    ...current,
    history: [],
  };

  saveAll(
    all
  );
}


export function displayGameVersion(
  state
) {
  const manual =
    cleanText(
      state?.manualVersion
    );

  if (manual) {
    return {
      value:
        manual,

      source:
        "Manual override",
    };
  }

  const current =
    state?.current;

  if (
    current?.productVersion
  ) {
    return {
      value:
        current.productVersion,

      source:
        "Product version",
    };
  }

  if (
    current?.fileVersion
  ) {
    return {
      value:
        current.fileVersion,

      source:
        "File version",
    };
  }

  if (
    current?.steamBuildId
  ) {
    return {
      value:
        `Build ${current.steamBuildId}`,

      source:
        "Steam build ID",
    };
  }

  return {
    value:
      "Unknown",

    source:
      "No version metadata detected",
  };
}


export async function checkGameVersion(
  game
) {
  const id =
    gameId(
      game
    );

  if (!id) {
    throw new Error(
      "Game does not have a stable ID."
    );
  }

  const store =
    cleanText(
      game?.store
      ?? game?.source
    );

  const launcherId =
    cleanText(
      game?.launcherId
      ?? game?.steamAppId
      ?? game?.appId
    );

  const installPath =
    cleanText(
      game?.installPath
    );

  const executablePath =
    getExecutablePath(
      game
    );

  const result =
    await invoke(
      "inspect_game_version",
      {
        store,
        launcherId,
        installPath,
        executablePath,
      }
    );

  const snapshot =
    normalizedSnapshot(
      result
    );

  if (!snapshot) {
    return getGameVersionState(
      game
    );
  }

  const all =
    loadAll();

  const previous =
    getGameVersionState(
      game
    );

  const oldCurrent =
    previous.current;

  const changed =
    oldCurrent
    && signature(
      oldCurrent
    )
      !== signature(
        snapshot
      );

  let history =
    previous.history;

  if (changed) {
    history = [
      oldCurrent,
      ...history,
    ]
      .filter(
        Boolean
      )
      .slice(
        0,
        50
      );
  }

  all[id] = {
    manualVersion:
      previous.manualVersion,

    current:
      snapshot,

    history,
  };

  saveAll(
    all
  );

  return {
    manualVersion:
      previous.manualVersion,

    current:
      snapshot,

    history,
  };
}


export const GAME_VERSION_CHANGED_EVENT =
  CHANGED_EVENT;
