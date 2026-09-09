const HEALTH_KEY =
  "game-manager-installation-health-v1";

export function healthGameKey(game) {
  return String(
    game?.id ??
      [
        game?.store ?? "",
        game?.launcherId ?? "",
        game?.name ?? "",
      ].join("::")
  );
}

function loadRecords() {
  try {
    return JSON.parse(
      localStorage.getItem(
        HEALTH_KEY
      )
    ) ?? {};
  } catch {
    return {};
  }
}

export function healthCategoryFromScore(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 55) return "needs-attention";
  return "incomplete";
}

export function healthCategoryLabel(category) {
  switch (category) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "needs-attention":
      return "Needs Attention";
    case "incomplete":
      return "Incomplete";
    default:
      return "Unknown";
  }
}

export function getInstallationHealthRecords() {
  return loadRecords();
}

export function storeInstallationHealth(
  game,
  summary
) {
  if (!game) return;

  const records =
    loadRecords();

  const score =
    Number(summary?.score) || 0;

  records[
    healthGameKey(game)
  ] = {
    gameId: game.id ?? null,
    name: game.name ?? "Unknown Game",
    store: game.store ?? "Unknown",
    launcherId: game.launcherId ?? null,
    score,
    category:
      healthCategoryFromScore(
        score
      ),
    passed:
      Number(summary?.passed) || 0,
    warnings:
      Number(summary?.warnings) || 0,
    informational:
      Number(summary?.informational) || 0,
    actionable:
      Number(summary?.actionable) || 0,
    updatedAt:
      new Date().toISOString(),
  };

  localStorage.setItem(
    HEALTH_KEY,
    JSON.stringify(records)
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-installation-health-changed"
    )
  );
}

export function getInstallationHealthSummary(
  games = []
) {
  const records =
    loadRecords();

  const rows =
    (games ?? []).map(
      (game) => ({
        game,
        record:
          records[
            healthGameKey(game)
          ] ?? null,
      })
    );

  const result = {
    total: rows.length,
    assessed: 0,
    excellent: 0,
    good: 0,
    "needs-attention": 0,
    incomplete: 0,
    unassessed: 0,
    rows,
  };

  rows.forEach(
    ({ record }) => {
      if (!record) {
        result.unassessed += 1;
        return;
      }

      result.assessed += 1;

      if (
        Object.prototype.hasOwnProperty.call(
          result,
          record.category
        )
      ) {
        result[
          record.category
        ] += 1;
      }
    }
  );

  return result;
}
