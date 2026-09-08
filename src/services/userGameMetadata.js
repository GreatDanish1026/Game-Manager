const STORAGE_KEY =
  "game-manager-user-game-metadata";


function loadAllMetadata() {
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

    return (
      parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
    )
      ? parsed
      : {};
  } catch (error) {
    console.error(
      "[User Metadata] Failed to load:",
      error
    );

    return {};
  }
}


function saveAllMetadata(
  metadata
) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        metadata
      )
    );
  } catch (error) {
    console.error(
      "[User Metadata] Failed to save:",
      error
    );

    throw error;
  }
}


function normalizedGameKey(
  game
) {
  if (game?.id) {
    return String(
      game.id
    );
  }

  return [
    game?.store
      ?? "unknown-store",
    game?.launcherId
      ?? "unknown-launcher",
    game?.name
      ?? "unknown-game",
  ].join(
    "::"
  );
}


function normalizeTags(
  tags
) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen =
    new Set();

  const output =
    [];

  for (const tag of tags) {
    if (
      typeof tag
      !== "string"
    ) {
      continue;
    }

    const cleaned =
      tag
        .trim()
        .replace(
          /\s+/g,
          " "
        )
        .slice(
          0,
          40
        );

    if (!cleaned) {
      continue;
    }

    const key =
      cleaned
        .toLocaleLowerCase();

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    output.push(
      cleaned
    );

    if (
      output.length
      >= 20
    ) {
      break;
    }
  }

  return output;
}


export function getGameUserMetadata(
  game
) {
  const all =
    loadAllMetadata();

  const key =
    normalizedGameKey(
      game
    );

  const value =
    all[key];

  return {
    favorite:
      Boolean(
        value?.favorite
      ),

    tags:
      normalizeTags(
        value?.tags
      ),
  };
}


export function saveGameUserMetadata(
  game,
  value
) {
  const all =
    loadAllMetadata();

  const key =
    normalizedGameKey(
      game
    );

  const next = {
    favorite:
      Boolean(
        value?.favorite
      ),

    tags:
      normalizeTags(
        value?.tags
      ),
  };

  if (
    !next.favorite
    && next.tags.length === 0
  ) {
    delete all[key];
  } else {
    all[key] =
      next;
  }

  saveAllMetadata(
    all
  );

  try {
    window.dispatchEvent(
      new CustomEvent(
        "game-manager-user-metadata-changed",
        {
          detail: {
            gameKey:
              key,

            metadata:
              next,
          },
        }
      )
    );
  } catch {
    // Event dispatch is only a UI refresh convenience.
  }

  return next;
}


export function toggleGameFavorite(
  game
) {
  const current =
    getGameUserMetadata(
      game
    );

  return saveGameUserMetadata(
    game,
    {
      ...current,

      favorite:
        !current.favorite,
    }
  );
}


export function addGameTag(
  game,
  tag
) {
  const current =
    getGameUserMetadata(
      game
    );

  return saveGameUserMetadata(
    game,
    {
      ...current,

      tags:
        [
          ...current.tags,
          tag,
        ],
    }
  );
}


export function removeGameTag(
  game,
  tag
) {
  const current =
    getGameUserMetadata(
      game
    );

  const target =
    String(
      tag
    )
    .toLocaleLowerCase();

  return saveGameUserMetadata(
    game,
    {
      ...current,

      tags:
        current.tags.filter(
          (item) =>
            item
              .toLocaleLowerCase()
              !== target
        ),
    }
  );
}


export function getAllGameTags(
  games
) {
  const counts =
    new Map();

  for (
    const game
    of games ?? []
  ) {
    const metadata =
      getGameUserMetadata(
        game
      );

    for (
      const tag
      of metadata.tags
    ) {
      const key =
        tag
          .toLocaleLowerCase();

      const existing =
        counts.get(
          key
        );

      if (existing) {
        existing.count +=
          1;
      } else {
        counts.set(
          key,
          {
            tag,
            count:
              1,
          }
        );
      }
    }
  }

  return Array.from(
    counts.values()
  )
    .sort(
      (left, right) =>
        left.tag.localeCompare(
          right.tag,
          undefined,
          {
            sensitivity:
              "base",
          }
        )
    );
}


export function isGameFavorite(
  game
) {
  return getGameUserMetadata(
    game
  ).favorite;
}


export function gameHasTag(
  game,
  tag
) {
  if (!tag) {
    return true;
  }

  const target =
    String(
      tag
    )
    .toLocaleLowerCase();

  return getGameUserMetadata(
    game
  )
    .tags
    .some(
      (item) =>
        item
          .toLocaleLowerCase()
          === target
    );
}


export function gameMatchesUserMetadataSearch(
  game,
  query
) {
  const normalized =
    String(
      query ?? ""
    )
    .trim()
    .toLocaleLowerCase();

  if (!normalized) {
    return true;
  }

  const metadata =
    getGameUserMetadata(
      game
    );

  return metadata.tags.some(
    (tag) =>
      tag
        .toLocaleLowerCase()
        .includes(
          normalized
        )
  );
}
