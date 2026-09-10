const STORAGE_KEY =
  "game-manager-launch-history-v1";

const MAX_ENTRIES_PER_GAME =
  100;


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


function normalizeEntry(
  entry
) {
  return {
    id:
      String(
        entry?.id
        ?? crypto.randomUUID()
      ),

    launchedAt:
      String(
        entry?.launchedAt
        ?? new Date()
          .toISOString()
      ),

    profileName:
      String(
        entry?.profileName
        ?? "Normal"
      ),

    launchMode:
      String(
        entry?.launchMode
        ?? "launcher"
      ),

    method:
      String(
        entry?.method
        ?? "unknown"
      ),

    store:
      String(
        entry?.store
        ?? ""
      ),

    executablePath:
      entry?.executablePath
        ? String(
            entry.executablePath
          )
        : null,

    arguments:
      Array.isArray(
        entry?.arguments
      )
        ? entry.arguments.map(
            String
          )
        : [],
  };
}


export function getLaunchHistory(
  game
) {
  const store =
    readStore();

  const raw =
    store[
      gameKey(
        game
      )
    ];

  if (
    !Array.isArray(
      raw
    )
  ) {
    return [];
  }

  return raw
    .map(
      normalizeEntry
    )
    .sort(
      (
        left,
        right
      ) =>
        new Date(
          right.launchedAt
        ).getTime()
        - new Date(
          left.launchedAt
        ).getTime()
    );
}


export function recordLaunchActivity(
  game,
  details = {}
) {
  const store =
    readStore();

  const key =
    gameKey(
      game
    );

  const existing =
    Array.isArray(
      store[key]
    )
      ? store[key]
      : [];

  const entry =
    normalizeEntry({
      ...details,

      id:
        crypto.randomUUID(),

      launchedAt:
        new Date()
          .toISOString(),

      store:
        details.store
        ?? game?.store
        ?? "",
    });

  store[key] = [
    entry,
    ...existing,
  ]
    .slice(
      0,
      MAX_ENTRIES_PER_GAME
    );

  writeStore(
    store
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-launch-history-changed",
      {
        detail: {
          gameKey:
            key,

          entry,
        },
      }
    )
  );

  return entry;
}


export function clearLaunchHistory(
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
      "game-manager-launch-history-changed",
      {
        detail: {
          gameKey:
            key,

          cleared:
            true,
        },
      }
    )
  );
}
