import {
  getName,
  getVersion,
} from "@tauri-apps/api/app";

import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getLibraryAnalysisSummary,
} from "./analysisState";

import {
  getInstallationHealthSummary,
} from "./installationHealth";

import {
  getLauncherStatus,
} from "./launcherStatus";

import {
  getBackupStorageSummary,
} from "./saveBackups";

import {
  getServiceStatuses,
  SERVICE_LABELS,
} from "./serviceStatus";

import {
  getCacheSummary,
  getSettings,
} from "./settings";


const UPDATER_ENDPOINT =
  "https://github.com/GreatDanish1026/Game-Manager/releases/latest/download/latest.json";

const DIAGNOSTICS_SCHEMA =
  1;


function formatBytes(
  bytes
) {
  const value =
    Number(bytes) || 0;

  if (value < 1024) {
    return `${value} B`;
  }

  const units = [
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  let next =
    value / 1024;

  let index =
    0;

  while (
    next >= 1024
    && index < units.length - 1
  ) {
    next /=
      1024;

    index +=
      1;
  }

  return `${next.toFixed(1)} ${units[index]}`;
}


function timestampText(
  value
) {
  if (!value) {
    return "Never";
  }

  try {
    return new Date(
      value
    ).toLocaleString();
  } catch {
    return String(
      value
    );
  }
}


function safeServiceRows() {
  const statuses =
    getServiceStatuses();

  return Object.values(
    statuses
  ).map(
    (record) => ({
      id:
        record.serviceId,

      label:
        SERVICE_LABELS[
          record.serviceId
        ]
        ?? record.serviceId,

      status:
        record.status
        ?? "unknown",

      checkedAt:
        record.checkedAt
        ?? null,
    })
  );
}


function safeSettings(
  settings
) {
  return {
    startupView:
      settings.startupView,

    showHiddenOnStartup:
      Boolean(
        settings.showHiddenOnStartup
      ),

    analysisConcurrency:
      settings.analysisConcurrency,

    analysisFreshDays:
      settings.analysisFreshDays,

    automaticUpdateChecks:
      Boolean(
        settings.automaticUpdateChecks
      ),

    compactGameRows:
      Boolean(
        settings.compactGameRows
      ),

    backupRetentionCount:
      settings.backupRetentionCount
      ?? 0,

    backupBeforeLaunch:
      Boolean(
        settings.backupBeforeLaunch
      ),
  };
}


export async function collectDiagnostics({
  games = [],
  networkOnline = true,
  updateCheckStatus = null,
} = {}) {
  const settings =
    getSettings();

  const [
    appNameResult,
    versionResult,
    hardwareResult,
    launchersResult,
    backupResult,
  ] =
    await Promise.allSettled([
      getName(),
      getVersion(),
      invoke(
        "get_system_hardware"
      ),
      getLauncherStatus(),
      getBackupStorageSummary(),
    ]);

  const hardware =
    hardwareResult.status ===
      "fulfilled"
      ? hardwareResult.value
      : null;

  const launchers =
    launchersResult.status ===
      "fulfilled"
      ? launchersResult.value
      : [];

  const backup =
    backupResult.status ===
      "fulfilled"
      ? backupResult.value
      : null;

  const analysis =
    getLibraryAnalysisSummary(
      games,
      settings.analysisFreshDays
    );

  const health =
    getInstallationHealthSummary(
      games
    );

  const cache =
    getCacheSummary();

  const savedViews =
    (() => {
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
    })();

  return {
    schemaVersion:
      DIAGNOSTICS_SCHEMA,

    generatedAt:
      new Date()
        .toISOString(),

    app: {
      name:
        appNameResult.status ===
          "fulfilled"
          ? appNameResult.value
          : "GameAtlas",

      version:
        versionResult.status ===
          "fulfilled"
          ? versionResult.value
          : "Unknown",

      updaterEndpoint:
        UPDATER_ENDPOINT,
    },

    connectivity: {
      online:
        Boolean(
          networkOnline
        ),

      updateCheckState:
        updateCheckStatus
        ?? null,
    },

    library: {
      installedGames:
        games.length,

      savedViews,

      analysis: {
        full:
          analysis.full,

        partial:
          analysis.partial,

        stale:
          analysis.stale,

        never:
          analysis.never,

        coverage:
          analysis.coverage,

        remaining:
          analysis.remaining,
      },

      installationHealth: {
        assessed:
          health.assessed,

        excellent:
          health.excellent,

        good:
          health.good,

        needsAttention:
          health[
            "needs-attention"
          ],

        incomplete:
          health.incomplete,

        unassessed:
          health.unassessed,
      },
    },

    hardware: hardware
      ? {
          cpu:
            hardware.cpuName
            ?? "Unknown",

          ramBytes:
            hardware.ramBytes
            ?? null,

          os:
            hardware.osName
            ?? "Unknown",

          osVersion:
            hardware.osVersion
            ?? "Unknown",

          gpus:
            (
              hardware.gpus
              ?? []
            ).map(
              (gpu) => ({
                name:
                  gpu.name,

                vendor:
                  gpu.vendor,

                memoryBytes:
                  gpu.dedicatedMemoryBytes
                  ?? null,
              })
            ),
        }
      : null,

    launchers:
      (
        launchers
        ?? []
      ).map(
        (launcher) => ({
          id:
            launcher.id,

          label:
            launcher.label,

          installed:
            Boolean(
              launcher.installed
            ),

          protocolRegistered:
            Boolean(
              launcher.protocolRegistered
            ),

          launchMethod:
            launcher.launchMethod,
        })
      ),

    externalServices:
      safeServiceRows(),

    backupStorage: backup
      ? {
          gameDirectoryCount:
            backup.gameDirectoryCount,

          backupCount:
            backup.backupCount,

          totalSizeBytes:
            backup.totalSizeBytes,
        }
      : null,

    cache: {
      analysisRecords:
        cache.analysisTimestamps
        ?? cache.analysisRecords
        ?? 0,

      libraryInsights:
        cache.libraryInsights
        ?? 0,

      libraryFilters:
        Boolean(
          cache.libraryFilters
        ),
    },

    settings:
      safeSettings(
        settings
      ),
  };
}


export function diagnosticsToText(
  diagnostics
) {
  const lines = [];

  const add =
    (
      label,
      value
    ) => {
      lines.push(
        `${label}: ${value ?? "Unknown"}`
      );
    };

  lines.push(
    "GameAtlas Diagnostics"
  );

  lines.push(
    "====================="
  );

  add(
    "Generated",
    timestampText(
      diagnostics.generatedAt
    )
  );

  add(
    "Diagnostics schema",
    diagnostics.schemaVersion
  );

  lines.push("");
  lines.push(
    "Application"
  );
  lines.push(
    "-----------"
  );

  add(
    "Name",
    diagnostics.app?.name
  );

  add(
    "Version",
    diagnostics.app?.version
  );

  add(
    "Updater endpoint",
    diagnostics.app
      ?.updaterEndpoint
  );

  lines.push("");
  lines.push(
    "Connectivity"
  );
  lines.push(
    "------------"
  );

  add(
    "Network",
    diagnostics.connectivity
      ?.online
      ? "Online"
      : "Offline"
  );

  if (
    diagnostics.connectivity
      ?.updateCheckState
  ) {
    add(
      "Update check state",
      typeof diagnostics.connectivity
        .updateCheckState === "string"
        ? diagnostics.connectivity
            .updateCheckState
        : JSON.stringify(
            diagnostics.connectivity
              .updateCheckState
          )
    );
  }

  lines.push("");
  lines.push(
    "System"
  );
  lines.push(
    "------"
  );

  if (
    diagnostics.hardware
  ) {
    add(
      "OS",
      `${diagnostics.hardware.os} ${diagnostics.hardware.osVersion}`
    );

    add(
      "CPU",
      diagnostics.hardware.cpu
    );

    add(
      "RAM",
      formatBytes(
        diagnostics.hardware.ramBytes
      )
    );

    (
      diagnostics.hardware.gpus
      ?? []
    ).forEach(
      (
        gpu,
        index
      ) => {
        add(
          `GPU ${index + 1}`,
          `${gpu.name} · ${formatBytes(
            gpu.memoryBytes
          )}`
        );
      }
    );
  } else {
    add(
      "Hardware",
      "Unavailable"
    );
  }

  lines.push("");
  lines.push(
    "Library"
  );
  lines.push(
    "-------"
  );

  add(
    "Installed games",
    diagnostics.library
      ?.installedGames
  );

  add(
    "Saved views",
    diagnostics.library
      ?.savedViews
  );

  const analysis =
    diagnostics.library
      ?.analysis
    ?? {};

  add(
    "Analysis coverage",
    `${analysis.coverage ?? 0}%`
  );

  add(
    "Fully analyzed",
    analysis.full
  );

  add(
    "Partially analyzed",
    analysis.partial
  );

  add(
    "Stale",
    analysis.stale
  );

  add(
    "Never analyzed",
    analysis.never
  );

  const health =
    diagnostics.library
      ?.installationHealth
    ?? {};

  add(
    "Health assessed",
    health.assessed
  );

  add(
    "Health excellent",
    health.excellent
  );

  add(
    "Health good",
    health.good
  );

  add(
    "Health needs attention",
    health.needsAttention
  );

  add(
    "Health incomplete",
    health.incomplete
  );

  add(
    "Health unassessed",
    health.unassessed
  );

  lines.push("");
  lines.push(
    "Launchers"
  );
  lines.push(
    "---------"
  );

  (
    diagnostics.launchers
    ?? []
  ).forEach(
    (launcher) => {
      add(
        launcher.label,
        launcher.installed
          ? `Available · ${launcher.launchMethod}`
          : "Not detected"
      );
    }
  );

  lines.push("");
  lines.push(
    "External Services"
  );
  lines.push(
    "-----------------"
  );

  (
    diagnostics.externalServices
    ?? []
  ).forEach(
    (service) => {
      add(
        service.label,
        `${service.status} · last checked ${timestampText(
          service.checkedAt
        )}`
      );
    }
  );

  lines.push("");
  lines.push(
    "Backups"
  );
  lines.push(
    "-------"
  );

  if (
    diagnostics.backupStorage
  ) {
    add(
      "Backup game folders",
      diagnostics.backupStorage
        .gameDirectoryCount
    );

    add(
      "Backup count",
      diagnostics.backupStorage
        .backupCount
    );

    add(
      "Backup storage",
      formatBytes(
        diagnostics.backupStorage
          .totalSizeBytes
      )
    );
  } else {
    add(
      "Backup storage",
      "Unavailable"
    );
  }

  lines.push("");
  lines.push(
    "Settings"
  );
  lines.push(
    "--------"
  );

  Object.entries(
    diagnostics.settings
    ?? {}
  ).forEach(
    ([
      key,
      value,
    ]) =>
      add(
        key,
        value
      )
  );

  lines.push("");
  lines.push(
    "Privacy"
  );
  lines.push(
    "-------"
  );
  lines.push(
    "This diagnostic report intentionally omits game installation paths, save paths, backup filenames, user tags, saved-view names, account identifiers, and updater signing material."
  );

  return lines.join(
    "\n"
  );
}


export async function exportDiagnosticsText(
  text
) {
  return invoke(
    "export_diagnostics_text",
    {
      content:
        text,
    }
  );
}
