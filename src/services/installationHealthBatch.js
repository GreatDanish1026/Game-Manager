import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getGameInsight,
} from "./libraryInsights";


const STORAGE_KEY =
  "game-manager-installation-health-batch-v1";

const FRESH_MS =
  24 * 60 * 60 * 1000;


function loadStore() {
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


function saveStore(
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
      "game-manager-installation-health-batch-changed"
    )
  );
}


export function getBatchHealthResults() {
  return loadStore();
}


export function getBatchHealthResult(
  game
) {
  if (!game?.id) {
    return null;
  }

  return loadStore()[
    game.id
  ] ?? null;
}


export function isBatchHealthFresh(
  result
) {
  if (!result?.checkedAt) {
    return false;
  }

  const checked =
    Date.parse(
      result.checkedAt
    );

  return Number.isFinite(
    checked
  )
    && (
      Date.now()
      - checked
    ) < FRESH_MS;
}


function healthState(
  score
) {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 75) {
    return "Good";
  }

  if (score >= 55) {
    return "Needs Attention";
  }

  return "Incomplete";
}


function buildNextSteps({
  installPath,
  localInspection,
  localError,
  insight,
}) {
  const steps = [];

  if (!installPath) {
    steps.push(
      "Correct or detect the install path."
    );
  }

  if (
    installPath
    && localError
  ) {
    steps.push(
      "Verify the install folder is still accessible."
    );
  }

  if (
    localInspection
    && !localInspection.executable
      ?.found
  ) {
    steps.push(
      "Review executable detection in Local Installation."
    );
  }

  if (!insight) {
    steps.push(
      "Run Library Analysis for richer PCGamingWiki and feature coverage."
    );
  }

  if (
    localInspection
      ?.scanTruncated
  ) {
    steps.push(
      "Local inspection reached its scan limit; review the game manually if needed."
    );
  }

  return steps.slice(
    0,
    3
  );
}


function scoreHealth({
  game,
  localInspection,
  localError,
  insight,
}) {
  let score = 0;

  const installPath =
    String(
      game?.installPath
      ?? ""
    ).trim();

  if (installPath) {
    score += 25;
  }

  if (
    installPath
    && localInspection
  ) {
    score += 25;
  }

  if (
    localInspection?.executable
      ?.found
  ) {
    score += 20;
  }

  if (
    localInspection
    && !localInspection
      .scanTruncated
  ) {
    score += 5;
  }

  if (insight) {
    score += 15;
  }

  if (
    insight?.pcgwPageName
    || insight?.pcgwMatched
    || insight?.pcgw
  ) {
    score += 5;
  }

  if (
    insight?.technical
      ?.configLocation
    || insight?.technical
      ?.saveLocation
  ) {
    score += 5;
  }

  if (localError) {
    score = Math.min(
      score,
      54
    );
  }

  return Math.max(
    0,
    Math.min(
      100,
      score
    )
  );
}


export async function scanGameInstallationHealth(
  game
) {
  const insight =
    getGameInsight(
      game
    );

  const installPath =
    String(
      game?.installPath
      ?? ""
    ).trim();

  let localInspection =
    null;

  let localError =
    null;

  if (installPath) {
    try {
      localInspection =
        await invoke(
          "inspect_local_installation",
          {
            gameName:
              game.name
              ?? "Unknown Game",

            installPath,
          }
        );
    } catch (error) {
      localError =
        String(
          error
        );
    }
  }

  const score =
    scoreHealth({
      game,
      localInspection,
      localError,
      insight,
    });

  const result = {
    gameId:
      game.id,

    name:
      game.name
      ?? "Unknown Game",

    store:
      game.store
      ?? "Unknown",

    checkedAt:
      new Date()
        .toISOString(),

    score,

    state:
      healthState(
        score
      ),

    installPathPresent:
      Boolean(
        installPath
      ),

    localScanSucceeded:
      Boolean(
        localInspection
      ),

    executableFound:
      Boolean(
        localInspection
          ?.executable
          ?.found
      ),

    scanTruncated:
      Boolean(
        localInspection
          ?.scanTruncated
      ),

    analyzed:
      Boolean(
        insight
      ),

    filesScanned:
      Number(
        localInspection
          ?.filesScanned
        ?? 0
      ),

    localError,

    nextSteps:
      buildNextSteps({
        installPath,
        localInspection,
        localError,
        insight,
      }),
  };

  const store =
    loadStore();

  store[
    game.id
  ] =
    result;

  saveStore(
    store
  );

  return result;
}


export function saveBatchHealthResults(
  results
) {
  const store =
    loadStore();

  for (const result of results) {
    if (
      result?.gameId
    ) {
      store[
        result.gameId
      ] =
        result;
    }
  }

  saveStore(
    store
  );
}


export function clearBatchHealthResults() {
  localStorage.removeItem(
    STORAGE_KEY
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-installation-health-batch-changed"
    )
  );
}


export function summarizeBatchHealth(
  games
) {
  const store =
    loadStore();

  const installedIds =
    new Set(
      (games ?? [])
        .map(
          (game) =>
            game.id
        )
        .filter(Boolean)
    );

  const results =
    Object.values(
      store
    )
      .filter(
        (result) =>
          installedIds.has(
            result.gameId
          )
      );

  const summary = {
    total:
      games?.length
      ?? 0,

    assessed:
      results.length,

    excellent:
      0,

    good:
      0,

    needsAttention:
      0,

    incomplete:
      0,

    stale:
      0,
  };

  for (const result of results) {
    if (
      !isBatchHealthFresh(
        result
      )
    ) {
      summary.stale += 1;
    }

    switch (
      result.state
    ) {
      case "Excellent":
        summary.excellent += 1;
        break;

      case "Good":
        summary.good += 1;
        break;

      case "Needs Attention":
        summary.needsAttention += 1;
        break;

      default:
        summary.incomplete += 1;
        break;
    }
  }

  return summary;
}
