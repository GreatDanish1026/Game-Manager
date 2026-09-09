const SETTINGS_KEY =
  "game-manager-settings-v1";

export const DEFAULT_SETTINGS = {
  startupView:
    "library",

  showHiddenOnStartup:
    false,

  analysisConcurrency:
    2,

  analysisFreshDays:
    7,

  automaticUpdateChecks:
    true,

  compactGameRows:
    false,
};


function sanitizeSettings(
  value
) {
  const source =
    value &&
    typeof value === "object"
      ? value
      : {};

  return {
    startupView:
      source.startupView ===
      "settings"
        ? "settings"
        : "library",

    showHiddenOnStartup:
      Boolean(
        source.showHiddenOnStartup
      ),

    analysisConcurrency:
      [1, 2, 3, 4].includes(
        Number(
          source.analysisConcurrency
        )
      )
        ? Number(
            source.analysisConcurrency
          )
        : DEFAULT_SETTINGS
            .analysisConcurrency,

    analysisFreshDays:
      [1, 3, 7, 14, 30]
        .includes(
          Number(
            source.analysisFreshDays
          )
        )
        ? Number(
            source.analysisFreshDays
          )
        : DEFAULT_SETTINGS
            .analysisFreshDays,

    automaticUpdateChecks:
      source.automaticUpdateChecks
      !== false,

    compactGameRows:
      Boolean(
        source.compactGameRows
      ),
  };
}


export function getSettings() {
  try {
    const raw =
      localStorage.getItem(
        SETTINGS_KEY
      );

    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
      };
    }

    return sanitizeSettings(
      JSON.parse(
        raw
      )
    );
  } catch (error) {
    console.error(
      "[Settings] Failed to load:",
      error
    );

    return {
      ...DEFAULT_SETTINGS,
    };
  }
}


export function saveSettings(
  settings
) {
  const next =
    sanitizeSettings(
      settings
    );

  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify(
      next
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-settings-changed",
      {
        detail:
          next,
      }
    )
  );

  return next;
}


export function updateSettings(
  patch
) {
  return saveSettings({
    ...getSettings(),
    ...patch,
  });
}


export function resetSettings() {
  return saveSettings(
    DEFAULT_SETTINGS
  );
}


export function clearAnalysisCache() {
  localStorage.removeItem(
    "game-manager-analysis-timestamps-v1"
  );

  localStorage.removeItem(
    "game-manager-analysis-state-v1"
  );

  localStorage.removeItem(
    "game-manager-library-insights"
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-library-insights-changed"
    )
  );
}


export function clearLibraryFilterCache() {
  localStorage.removeItem(
    "game-manager-library-filters"
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-library-filters-cleared"
    )
  );
}


export function clearSafeCaches() {
  clearAnalysisCache();
  clearLibraryFilterCache();
}


export function getCacheSummary() {
  const bytesFor =
    (key) => {
      const value =
        localStorage.getItem(
          key
        );

      return value
        ? new Blob(
            [value]
          ).size
        : 0;
    };

  const timestampsRaw =
    localStorage.getItem(
      "game-manager-analysis-timestamps-v1"
    );

  const insightsRaw =
    localStorage.getItem(
      "game-manager-library-insights"
    );

  const stateRaw =
    localStorage.getItem(
      "game-manager-analysis-state-v1"
    );

  let timestampCount = 0;
  let insightCount = 0;
  let stateCount = 0;

  try {
    timestampCount =
      Object.keys(
        JSON.parse(
          timestampsRaw ?? "{}"
        )
      ).length;
  } catch {
    timestampCount = 0;
  }

  try {
    insightCount =
      Object.keys(
        JSON.parse(
          insightsRaw ?? "{}"
        )
      ).length;
  } catch {
    insightCount = 0;
  }

  try {
    stateCount =
      Object.keys(
        JSON.parse(
          stateRaw ?? "{}"
        )
      ).length;
  } catch {
    stateCount = 0;
  }

  return {
    analysisEntries:
      Math.max(
        timestampCount,
        insightCount,
        stateCount
      ),

    analysisBytes:
      bytesFor(
        "game-manager-analysis-timestamps-v1"
      ) +
      bytesFor(
        "game-manager-analysis-state-v1"
      ) +
      bytesFor(
        "game-manager-library-insights"
      ),

    filterBytes:
      bytesFor(
        "game-manager-library-filters"
      ),
  };
}
