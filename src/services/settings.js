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

  backupRetentionCount:
    0,

  backupBeforeLaunch:
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

    backupRetentionCount:
      [0, 3, 5, 10, 20]
        .includes(
          Number(
            source.backupRetentionCount
          )
        )
        ? Number(
            source.backupRetentionCount
          )
        : DEFAULT_SETTINGS
            .backupRetentionCount,

    backupBeforeLaunch:
      Boolean(
        source.backupBeforeLaunch
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


export function clearExternalServiceStatusCache() {
  localStorage.removeItem(
    "game-manager-service-status-v1"
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-service-status-changed"
    )
  );
}


export function clearInstallationHealthCache() {
  localStorage.removeItem(
    "game-manager-installation-health-v1"
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-installation-health-changed"
    )
  );
}


export function clearSavedViews() {
  localStorage.removeItem(
    "game-manager-saved-views-v1"
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-saved-views-changed"
    )
  );
}


export function clearSafeCaches() {
  clearAnalysisCache();
  clearLibraryFilterCache();
  clearExternalServiceStatusCache();
  clearInstallationHealthCache();
}


export function getSavedViewCount() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          "game-manager-saved-views-v1"
        )
        ?? "[]"
      );

    return Array.isArray(
      parsed
    )
      ? parsed.length
      : 0;
  } catch {
    return 0;
  }
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

  const objectCount =
    (key) => {
      try {
        const parsed =
          JSON.parse(
            localStorage.getItem(
              key
            )
            ?? "{}"
          );

        return parsed
          && typeof parsed
            === "object"
          && !Array.isArray(
            parsed
          )
          ? Object.keys(
              parsed
            ).length
          : 0;
      } catch {
        return 0;
      }
    };

  const timestampCount =
    objectCount(
      "game-manager-analysis-timestamps-v1"
    );

  const insightCount =
    objectCount(
      "game-manager-library-insights"
    );

  const stateCount =
    objectCount(
      "game-manager-analysis-state-v1"
    );

  const serviceStatusCount =
    objectCount(
      "game-manager-service-status-v1"
    );

  const installationHealthCount =
    objectCount(
      "game-manager-installation-health-v1"
    );

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

    serviceStatusEntries:
      serviceStatusCount,

    serviceStatusBytes:
      bytesFor(
        "game-manager-service-status-v1"
      ),

    installationHealthEntries:
      installationHealthCount,

    installationHealthBytes:
      bytesFor(
        "game-manager-installation-health-v1"
      ),

    savedViews:
      getSavedViewCount(),

    savedViewsBytes:
      bytesFor(
        "game-manager-saved-views-v1"
      ),
  };
}
