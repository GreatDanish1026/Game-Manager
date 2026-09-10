const STORAGE_KEY =
  "game-manager-play-status-notes-v1";


export const PLAY_STATUSES = [
  {
    id:
      "not_started",

    label:
      "Not Started",
  },

  {
    id:
      "playing",

    label:
      "Playing",
  },

  {
    id:
      "completed",

    label:
      "Completed",
  },

  {
    id:
      "on_hold",

    label:
      "On Hold",
  },

  {
    id:
      "dropped",

    label:
      "Dropped",
  },

  {
    id:
      "replay",

    label:
      "Replay",
  },
];


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


function emptyEntry() {
  return {
    status:
      "not_started",

    progress:
      "",

    notes:
      "",

    updatedAt:
      null,
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

    if (
      !parsed
      || typeof parsed
        !== "object"
      || Array.isArray(
        parsed
      )
    ) {
      return {};
    }

    return parsed;
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
  value
) {
  const allowed =
    new Set(
      PLAY_STATUSES.map(
        (
          status
        ) =>
          status.id
      )
    );

  const status =
    allowed.has(
      value?.status
    )
      ? value.status
      : "not_started";

  return {
    status,

    progress:
      String(
        value?.progress
        ?? ""
      ),

    notes:
      String(
        value?.notes
        ?? ""
      ),

    updatedAt:
      typeof value?.updatedAt
        === "string"
        ? value.updatedAt
        : null,
  };
}


export function getPlayStatusNotes(
  game
) {
  const store =
    readStore();

  return normalizeEntry(
    store[
      gameKey(
        game
      )
    ]
    ?? emptyEntry()
  );
}


export function savePlayStatusNotes(
  game,
  entry
) {
  const store =
    readStore();

  const key =
    gameKey(
      game
    );

  const normalized =
    normalizeEntry(
      entry
    );

  const saved = {
    ...normalized,

    updatedAt:
      new Date()
        .toISOString(),
  };

  store[key] =
    saved;

  writeStore(
    store
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-play-status-notes-changed",
      {
        detail: {
          gameKey:
            key,

          entry:
            saved,
        },
      }
    )
  );

  return saved;
}


export function clearPlayStatusNotes(
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
      "game-manager-play-status-notes-changed",
      {
        detail: {
          gameKey:
            key,

          entry:
            emptyEntry(),
        },
      }
    )
  );

  return emptyEntry();
}


export function playStatusLabel(
  status
) {
  return PLAY_STATUSES.find(
    (
      item
    ) =>
      item.id
        === status
  )?.label
    ?? "Not Started";
}
