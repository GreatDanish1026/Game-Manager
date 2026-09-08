const INSIGHTS_KEY =
  "game-manager-library-insights";

const SNAPSHOT_KEY =
  "game-manager-library-snapshot";

function parseStored(
  key,
  fallback
) {
  try {
    return JSON.parse(
      localStorage.getItem(key)
    ) ?? fallback;
  } catch {
    return fallback;
  }
}

export function gameInsightKey(
  game
) {
  return String(
    game?.id
    ?? [
      game?.store ?? "",
      game?.launcherId ?? "",
      game?.name ?? "",
    ].join("::")
  );
}

export function getLibraryInsights() {
  return parseStored(
    INSIGHTS_KEY,
    {}
  );
}

export function getGameInsight(
  game
) {
  return getLibraryInsights()[
    gameInsightKey(game)
  ] ?? null;
}

function saveInsights(
  insights
) {
  localStorage.setItem(
    INSIGHTS_KEY,
    JSON.stringify(insights)
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-library-insights-changed"
    )
  );
}

function booleanOrNull(
  value
) {
  return typeof value === "boolean"
    ? value
    : null;
}

export function storeGameInsight(
  game
) {
  if (!game?.id) {
    return;
  }

  const features =
    game.features ?? {};

  const insights =
    getLibraryInsights();

  insights[
    gameInsightKey(game)
  ] = {
    id: game.id,
    name: game.name ?? null,
    store: game.store ?? null,
    updatedAt: new Date().toISOString(),

    hdr:
      booleanOrNull(
        features.hdr
      ),

    rayTracing:
      booleanOrNull(
        features.rayTracing
      ),

    upscaling:
      booleanOrNull(
        features.upscaling
      ),

    upscalingTech:
      features.upscalingTech
      ?? null,

    frameGeneration:
      booleanOrNull(
        features.frameGeneration
      ),

    frameGenerationTech:
      features.frameGenerationTech
      ?? null,

    ultrawide:
      booleanOrNull(
        features.ultrawide
      ),

    fourK:
      booleanOrNull(
        features.fourK
      ),

    oneTwentyFps:
      booleanOrNull(
        features.oneTwentyFps
      ),

    renodx:
      Boolean(
        game.renodx
          ?.renodx
          ?.available
      ),

    luma:
      Boolean(
        game.renodx
          ?.luma
          ?.available
      ),

    vortex:
      Boolean(
        game.vortex
          ?.supported
      ),

    fluffy:
      Boolean(
        game.fluffy
          ?.supported
      ),
  };

  saveInsights(
    insights
  );
}

export function saveLibrarySnapshot(
  games,
  totalGames
) {
  const current =
    parseStored(
      SNAPSHOT_KEY,
      {
        games: {},
      }
    );

  const indexed = {
    ...(
      current.games
      ?? {}
    ),
  };

  for (
    const game
    of games ?? []
  ) {
    const key =
      gameInsightKey(game);

    indexed[key] = {
      id: game.id ?? null,
      name: game.name ?? "Unknown Game",
      store: game.store ?? "Unknown",
      launcherId:
        game.launcherId
        ?? null,
    };
  }

  localStorage.setItem(
    SNAPSHOT_KEY,
    JSON.stringify({
      totalGames:
        Number(
          totalGames
          ?? Object.keys(indexed).length
        ),

      updatedAt:
        new Date().toISOString(),

      games:
        indexed,
    })
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-library-snapshot-changed"
    )
  );
}

export function getLibrarySnapshot() {
  return parseStored(
    SNAPSHOT_KEY,
    {
      totalGames: 0,
      games: {},
    }
  );
}

function includesText(
  value,
  search
) {
  return String(
    value
    ?? ""
  )
    .toLowerCase()
    .includes(search);
}

export function insightMatchesFilter(
  insight,
  filter
) {
  if (!filter) {
    return true;
  }

  if (!insight) {
    return false;
  }

  switch (filter) {
    case "hdr":
      return insight.hdr === true;

    case "ray-tracing":
      return insight.rayTracing === true;

    case "upscaling":
      return insight.upscaling === true;

    case "dlss":
      return (
        insight.upscaling === true
        && includesText(
          insight.upscalingTech,
          "dlss"
        )
      );

    case "frame-generation":
      return insight.frameGeneration === true;

    case "dlss-frame-generation":
      return (
        insight.frameGeneration === true
        && includesText(
          insight.frameGenerationTech,
          "dlss"
        )
      );

    case "ultrawide":
      return insight.ultrawide === true;

    case "4k":
      return insight.fourK === true;

    case "120fps":
      return insight.oneTwentyFps === true;

    case "renodx":
      return insight.renodx === true;

    case "luma":
      return insight.luma === true;

    case "vortex":
      return insight.vortex === true;

    case "fluffy":
      return insight.fluffy === true;

    default:
      return true;
  }
}
