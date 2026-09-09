const STORAGE_KEY =
  "game-manager-library-overrides-v1";


function loadAll() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEY
        )
        ?? "{}"
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
      "game-manager-library-overrides-changed"
    )
  );
}


export function getLibraryOverride(
  game
) {
  if (!game?.id) {
    return null;
  }

  return loadAll()[
    game.id
  ] ?? null;
}


export function applyLibraryOverride(
  game
) {
  if (!game?.id) {
    return game;
  }

  const override =
    getLibraryOverride(
      game
    );

  if (!override) {
    return game;
  }

  return {
    ...game,

    name:
      override.name
      || game.name,

    store:
      override.store
      || game.store,

    launcherId:
      override.launcherId
      || game.launcherId,

    installPath:
      override.installPath
      || game.installPath,

    libraryOverride:
      override,
  };
}


export function setLibraryOverride(
  game,
  patch
) {
  if (!game?.id) {
    throw new Error(
      "Cannot save a library override for a game without an ID."
    );
  }

  const all =
    loadAll();

  const cleaned = {
    name:
      String(
        patch?.name
        ?? ""
      ).trim(),

    store:
      String(
        patch?.store
        ?? ""
      ).trim(),

    launcherId:
      String(
        patch?.launcherId
        ?? ""
      ).trim(),

    installPath:
      String(
        patch?.installPath
        ?? ""
      ).trim(),
  };

  const hasValue =
    Object.values(
      cleaned
    ).some(Boolean);

  if (hasValue) {
    all[
      game.id
    ] = cleaned;
  } else {
    delete all[
      game.id
    ];
  }

  saveAll(
    all
  );

  return hasValue
    ? cleaned
    : null;
}


export function clearLibraryOverride(
  game
) {
  if (!game?.id) {
    return;
  }

  const all =
    loadAll();

  delete all[
    game.id
  ];

  saveAll(
    all
  );
}


export function getLibraryOverrideCount() {
  return Object.keys(
    loadAll()
  ).length;
}
