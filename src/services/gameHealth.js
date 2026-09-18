import {
  getBackgroundConflictReport,
} from "./backgroundConflicts";

import {
  getControllerConflictReport,
} from "./controllerConflicts";

import {
  getCrashDetectiveReport,
} from "./crashDetective";

import {
  getDisplayValidationReport,
} from "./displayValidator";

import {
  getGraphicsDriverDiagnostics,
} from "./graphicsDriverDiagnostics";

import {
  inspectLocalInstallation,
} from "./localInstallation";

import {
  getSaveBackupStatus,
} from "./saveBackups";

import {
  getRuntimeDependencyReport,
} from "./runtimeDependencyDoctor";

import {
  getWindowsPerformanceDiagnostics,
} from "./windowsPerformanceDiagnostics";


function finding({
  id,
  source,
  severity,
  title,
  detail,
  suggestion = null,
  action = null,
}) {
  return {
    id,
    source,
    severity,
    title,
    detail,
    suggestion,
    action,
  };
}


function normalizeFindingSeverity(
  severity,
  warningSeverity = "attention"
) {
  if (severity === "warning") {
    return warningSeverity;
  }

  if (severity === "good") {
    return "good";
  }

  return "information";
}


function errorText(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}


function unavailableFinding(
  id,
  label,
  error
) {
  return finding({
    id:
      `${id}.unavailable`,

    source:
      label,

    severity:
      "unavailable",

    title:
      `${label} could not be checked`,

    detail:
      errorText(error),

    suggestion:
      "Try the check again. The detailed diagnostic remains available in Technical & Troubleshooting.",
  });
}


function installationFindings(
  game,
  local,
  backups
) {
  const results = [];

  if (game.installPath) {
    results.push(
      finding({
        id:
          "installation.path",

        source:
          "Installation",

        severity:
          "good",

        title:
          "Install path is available",

        detail:
          game.installPath,

        action:
          {
            type:
              "open-path",

            label:
              "Open Folder",

            path:
              game.installPath,
          },
      })
    );
  } else {
    results.push(
      finding({
        id:
          "installation.path",

        source:
          "Installation",

        severity:
          "attention",

        title:
          "Install path is unavailable",

        detail:
          "GameAtlas cannot inspect local files or open the installation folder for this entry.",

        suggestion:
          "Edit the library entry and select the game's installation folder.",
      })
    );
  }

  if (local?.executable?.found) {
    results.push(
      finding({
        id:
          "installation.executable",

        source:
          "Installation",

        severity:
          "good",

        title:
          "Primary game binary detected",

        detail:
          local.executable.fileName
          ?? "A likely game executable was found.",
      })
    );
  } else if (
    game.installPath
    && local !== undefined
  ) {
    results.push(
      finding({
        id:
          "installation.executable",

        source:
          "Installation",

        severity:
          "attention",

        title:
          "Primary game binary was not detected",

        detail:
          "The selected folder does not contain a likely game executable or launcher.",

        suggestion:
          "Confirm that the saved install path points to the game's main folder.",
      })
    );
  }

  if (game.technical?.saveLocation) {
    if (backups === undefined) {
      // A dedicated unavailable finding is added by the caller.
    } else if (backups?.backupCount > 0) {
      results.push(
        finding({
          id:
            "installation.save-backup",

          source:
            "Save protection",

          severity:
            "good",

          title:
            "Save backup is available",

          detail:
            `${backups.backupCount} GameAtlas backup${backups.backupCount === 1 ? "" : "s"} found.`,
        })
      );
    } else {
      results.push(
        finding({
          id:
            "installation.save-backup",

          source:
            "Save protection",

          severity:
            "recommendation",

          title:
            "Create a first save backup",

          detail:
            "A save location is known, but no GameAtlas backup is available yet.",

          suggestion:
            "Create a backup before changing game files, mods, or configuration.",

          action:
            {
              type:
                "create-save-backup",

              label:
                "Create Backup",
            },
        })
      );
    }
  } else {
    results.push(
      finding({
        id:
          "installation.save-location",

        source:
          "Save protection",

        severity:
          "information",

        title:
          "Save location is not available",

        detail:
          "No save path was reported for this game, so backup readiness could not be assessed.",
      })
    );
  }

  return results;
}


function performanceFindings(report) {
  if (!report?.supported) {
    return [];
  }

  return (report.checks ?? []).map(
    (check) =>
      finding({
        id:
          `performance.${check.key}`,

        source:
          "Performance",

        severity:
          check.state === "warn"
            ? "attention"
            : check.state === "pass"
              ? "good"
              : "information",

        title:
          check.label,

        detail:
          check.detail,

        suggestion:
          check.suggestion
          ?? null,
      })
  );
}


function reportFindings(
  report,
  {
    id,
    label,
    warningSeverity = "attention",
  }
) {
  if (!report?.supported) {
    return [];
  }

  return (report.findings ?? []).map(
    (item, index) =>
      finding({
        id:
          `${id}.${index}`,

        source:
          label,

        severity:
          normalizeFindingSeverity(
            item.severity,
            warningSeverity
          ),

        title:
          item.title,

        detail:
          item.detail,

        suggestion:
          item.suggestion
          ?? null,
      })
  );
}


async function settleCheck({
  id,
  label,
  task,
  map,
  sectionIds = [],
  targetId = null,
}) {
  try {
    const value =
      await task();

    return {
      scan: {
        id,
        label,
        sectionIds,
        targetId,
        status:
          value?.supported === false
            ? "unsupported"
            : "complete",
      },

      findings:
        map(value),
    };
  } catch (error) {
    return {
      scan: {
        id,
        label,
        sectionIds,
        targetId,
        status:
          "failed",
      },

      findings: [
        unavailableFinding(
          id,
          label,
          error
        ),
      ],
    };
  }
}


export function summarizeGameHealth(
  findings
) {
  const counts = {
    attention:
      0,

    recommendation:
      0,

    good:
      0,

    information:
      0,

    unavailable:
      0,
  };

  for (const item of findings) {
    if (
      Object.prototype
        .hasOwnProperty
        .call(
          counts,
          item.severity
        )
    ) {
      counts[item.severity] +=
        1;
    }
  }

  const scored =
    counts.good
    + counts.attention;

  const score =
    scored > 0
      ? Math.round(
          (
            counts.good
            / scored
          )
          * 100
        )
      : 0;

  return {
    counts,
    score,
    status:
      counts.attention > 0
        ? "attention"
        : counts.recommendation > 0
          ? "recommendation"
          : counts.good > 0
            ? "good"
            : "incomplete",
  };
}


export async function runGameHealthCheck(
  game,
  {
    includeWindows = true,
    onProgress = () => {},
  } = {}
) {
  const findings = [];
  const scans = [];
  const totalScans =
    includeWindows
      ? 8
      : 1;
  let completedScans =
    0;

  const updateProgress =
    (label) =>
      onProgress({
        label,
        completed:
          completedScans,
        total:
          totalScans,
      });

  updateProgress(
    "Checking installation and save protection…"
  );

  const [
    localResult,
    backupResult,
  ] =
    await Promise.allSettled([
      inspectLocalInstallation(
        game,
        {
          force:
            true,
        }
      ),
      game.technical?.saveLocation
        ? getSaveBackupStatus(
            game
          )
        : Promise.resolve(
            null
          ),
    ]);

  const local =
    localResult.status === "fulfilled"
      ? localResult.value
      : undefined;

  const backups =
    backupResult.status === "fulfilled"
      ? backupResult.value
      : undefined;

  findings.push(
    ...installationFindings(
      game,
      local,
      backups
    )
  );

  scans.push({
    id:
      "installation",

    label:
      "Installation",

    sectionIds: [
      "files-installation",
    ],

    targetId:
      "game-section-files-installation",

    status:
      localResult.status === "fulfilled"
        ? "complete"
        : "failed",
  });

  completedScans +=
    1;

  if (localResult.status === "rejected") {
    findings.push(
      unavailableFinding(
        "installation",
        "Local installation",
        localResult.reason
      )
    );
  }

  if (backupResult.status === "rejected") {
    findings.push(
      unavailableFinding(
        "save-backup",
        "Save protection",
        backupResult.reason
      )
    );
  }

  if (includeWindows) {
    updateProgress(
      "Checking performance, graphics drivers, and displays…"
    );

    const firstBatch =
      await Promise.all([
        settleCheck({
          id:
            "performance",

          label:
            "Windows performance",

          sectionIds: [
            "technical-troubleshooting",
          ],

          targetId:
            "diagnostic-windows-performance",

          task:
            () =>
              getWindowsPerformanceDiagnostics(
                game
              ),

          map:
            performanceFindings,
        }),
        settleCheck({
          id:
            "graphics-driver",

          label:
            "Graphics drivers",

          sectionIds: [
            "technical-troubleshooting",
          ],

          targetId:
            "diagnostic-graphics-drivers",

          task:
            getGraphicsDriverDiagnostics,

          map:
            (report) =>
              reportFindings(
                report,
                {
                  id:
                    "graphics-driver",

                  label:
                    "Graphics drivers",
                }
              ),
        }),
        settleCheck({
          id:
            "display",

          label:
            "Display and HDR",

          sectionIds: [
            "technical-troubleshooting",
          ],

          targetId:
            "diagnostic-display",

          task:
            () =>
              getDisplayValidationReport(
                game
              ),

          map:
            (report) =>
              reportFindings(
                report,
                {
                  id:
                    "display",

                  label:
                    "Display and HDR",
                }
              ),
        }),
      ]);

    firstBatch.forEach(
      (result) => {
        scans.push(
          result.scan
        );

        findings.push(
          ...result.findings
        );
      }
    );

    completedScans +=
      firstBatch.length;

    updateProgress(
      "Checking crashes and runtime dependencies…"
    );

    const stabilityBatch =
      await Promise.all([
        settleCheck({
          id:
            "crash-detective",

          label:
            "Crash Detective",

          sectionIds: [
            "technical-troubleshooting",
          ],

          targetId:
            "diagnostic-crash-detective",

          task:
            () =>
              getCrashDetectiveReport(
                game
              ),

          map:
            (report) =>
              reportFindings(
                report,
                {
                  id:
                    "crash-detective",

                  label:
                    "Crash Detective",
                }
              ),
        }),
        settleCheck({
          id:
            "runtime-dependencies",

          label:
            "Runtime dependencies",

          sectionIds: [
            "technical-troubleshooting",
          ],

          targetId:
            "diagnostic-runtime-dependencies",

          task:
            () =>
              getRuntimeDependencyReport(
                game
              ),

          map:
            (report) =>
              reportFindings(
                report,
                {
                  id:
                    "runtime-dependencies",

                  label:
                    "Runtime dependencies",
                }
              ),
        }),
      ]);

    stabilityBatch.forEach(
      (result) => {
        scans.push(
          result.scan
        );

        findings.push(
          ...result.findings
        );
      }
    );

    completedScans +=
      stabilityBatch.length;

    updateProgress(
      "Checking background apps and controllers…"
    );

    const secondBatch =
      await Promise.all([
        settleCheck({
          id:
            "background-apps",

          label:
            "Background apps",

          sectionIds: [
            "technical-troubleshooting",
          ],

          targetId:
            "diagnostic-background-apps",

          task:
            getBackgroundConflictReport,

          map:
            (report) =>
              reportFindings(
                report,
                {
                  id:
                    "background-apps",

                  label:
                    "Background apps",

                  warningSeverity:
                    "recommendation",
                }
              ),
        }),
        settleCheck({
          id:
            "controllers",

          label:
            "Controllers",

          sectionIds: [
            "pc-features",
            "controller-support",
          ],

          targetId:
            "game-section-controller-support",

          task:
            getControllerConflictReport,

          map:
            (report) =>
              reportFindings(
                report,
                {
                  id:
                    "controllers",

                  label:
                    "Controllers",

                  warningSeverity:
                    "recommendation",
                }
              ),
        }),
      ]);

    secondBatch.forEach(
      (result) => {
        scans.push(
          result.scan
        );

        findings.push(
          ...result.findings
        );
      }
    );

    completedScans +=
      secondBatch.length;
  }

  updateProgress(
    "Finalizing diagnostic summary…"
  );

  return {
    checkedAt:
      new Date()
        .toISOString(),

    findings,
    scans,
    ...summarizeGameHealth(
      findings
    ),
  };
}
