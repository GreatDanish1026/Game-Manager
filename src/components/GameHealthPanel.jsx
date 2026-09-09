import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  HeartPulse,
  Loader2,
  RefreshCcw,
  FolderOpen,
  Save,
  Wrench,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  inspectLocalInstallation,
} from "../services/localInstallation";

import {
  createSaveBackup,
  getSaveBackupStatus,
} from "../services/saveBackups";

import {
  openGamePath,
} from "../services/pathActions";

import {
  storeInstallationHealth,
} from "../services/installationHealth";


function HealthCheck({
  label,
  detail,
  state,
  actionLabel = null,
  onAction = null,
  actionDisabled = false,
  actionBusy = false,
}) {
  const icon =
    state === "pass"
      ? (
        <CheckCircle2
          className="
            h-4
            w-4
            shrink-0
            text-emerald-300/80
          "
        />
      )
      : state === "warn"
        ? (
          <AlertTriangle
            className="
              h-4
              w-4
              shrink-0
              text-amber-300/80
            "
          />
        )
        : (
          <CircleDashed
            className="
              h-4
              w-4
              shrink-0
              text-white/20
            "
          />
        );

  return (
    <div
      className="
        flex
        items-start
        gap-3
        border-b
        border-white/[0.055]
        px-4
        py-3
        last:border-b-0
      "
    >
      {icon}

      <div
        className="
          min-w-0
          flex-1
        "
      >
        <div
          className="
            flex
            items-start
            justify-between
            gap-3
          "
        >
          <div
            className="
              min-w-0
            "
          >
            <div
              className={`
                text-sm
                font-medium
                ${
                  state === "pass"
                    ? "text-white/70"
                    : state === "warn"
                      ? "text-amber-100/70"
                      : "text-white/35"
                }
              `}
            >
              {label}
            </div>

            {detail ? (
              <div
                className="
                  mt-0.5
                  text-xs
                  leading-relaxed
                  text-white/28
                "
              >
                {detail}
              </div>
            ) : null}
          </div>

          {actionLabel ? (
            <button
              type="button"
              onClick={onAction}
              disabled={
                actionDisabled
                || actionBusy
              }
              className="
                inline-flex
                shrink-0
                items-center
                gap-1.5
                rounded-lg
                border
                border-white/[0.08]
                bg-white/[0.025]
                px-2.5
                py-1.5
                text-[10px]
                font-semibold
                text-white/55
                transition
                hover:bg-white/[0.06]
                hover:text-white/75
                disabled:opacity-30
              "
            >
              {actionLabel === "Create Backup" ? (
                <Save className="h-3 w-3" />
              ) : (
                <FolderOpen className="h-3 w-3" />
              )}

              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}


function gradeFromScore(
  score
) {
  if (score >= 90) {
    return {
      label:
        "Excellent",

      className:
        "text-emerald-200 border-emerald-400/20 bg-emerald-400/[0.06]",
    };
  }

  if (score >= 75) {
    return {
      label:
        "Good",

      className:
        "text-cyan-200 border-cyan-400/20 bg-cyan-400/[0.06]",
    };
  }

  if (score >= 55) {
    return {
      label:
        "Needs Attention",

      className:
        "text-amber-200 border-amber-400/20 bg-amber-400/[0.06]",
    };
  }

  return {
    label:
      "Incomplete",

    className:
      "text-white/50 border-white/10 bg-white/[0.025]",
  };
}


export default function GameHealthPanel({
  game,
}) {
  const [
    local,
    setLocal,
  ] =
    useState(null);

  const [
    backups,
    setBackups,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);

  const [
    backupBusy,
    setBackupBusy,
  ] =
    useState(false);

  const [
    actionMessage,
    setActionMessage,
  ] =
    useState(null);


  async function refresh() {
    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const tasks =
        [
          inspectLocalInstallation(
            game,
            {
              force:
                true,
            }
          ),
        ];

      if (
        game.technical
          ?.saveLocation
      ) {
        tasks.push(
          getSaveBackupStatus(
            game
          )
        );
      } else {
        tasks.push(
          Promise.resolve(
            null
          )
        );
      }

      const [
        localResult,
        backupResult,
      ] =
        await Promise.allSettled(
          tasks
        );

      if (
        localResult.status
        === "fulfilled"
      ) {
        setLocal(
          localResult.value
        );
      } else {
        setLocal(
          null
        );
      }

      if (
        backupResult.status
        === "fulfilled"
      ) {
        setBackups(
          backupResult.value
        );
      } else {
        setBackups(
          null
        );
      }

      if (
        localResult.status
        === "rejected"
      ) {
        setError(
          String(
            localResult.reason
          )
        );
      }
    } finally {
      setLoading(
        false
      );
    }
  }


  async function handleOpenPath(
    path
  ) {
    setActionMessage(
      null
    );

    try {
      await openGamePath(
        path,
        game.installPath
      );
    } catch (openError) {
      setActionMessage(
        String(openError)
      );
    }
  }


  async function handleCreateBackup() {
    if (
      !game.technical
        ?.saveLocation
    ) {
      return;
    }

    setBackupBusy(
      true
    );

    setActionMessage(
      null
    );

    try {
      await createSaveBackup(
        game
      );

      const next =
        await getSaveBackupStatus(
          game
        );

      setBackups(
        next
      );

      setActionMessage(
        "Save backup created successfully."
      );
    } catch (backupError) {
      setActionMessage(
        `Backup failed: ${String(
          backupError
        )}`
      );
    } finally {
      setBackupBusy(
        false
      );
    }
  }


  useEffect(
    () => {
      refresh();
    },
    [
      game?.id,
      game?.installPath,
      game?.technical
        ?.saveLocation,
    ]
  );


  const checks =
    useMemo(
      () => {
        const list =
          [];

        list.push(
          {
            label:
              "Install path available",

            detail:
              game.installPath,

            state:
              game.installPath
                ? "pass"
                : "warn",

            actionLabel:
              game.installPath
                ? "Open"
                : null,

            onAction:
              game.installPath
                ? () =>
                    handleOpenPath(
                      game.installPath
                    )
                : null,
          }
        );

        list.push(
          {
            label:
              "Primary executable detected",

            detail:
              local?.executable
                ?.fileName
                ?? "No likely primary executable identified.",

            state:
              local?.executable
                ?.found
                ? "pass"
                : "warn",

            actionLabel:
              game.installPath
                ? "Open Folder"
                : null,

            onAction:
              game.installPath
                ? () =>
                    handleOpenPath(
                      game.installPath
                    )
                : null,
          }
        );

        list.push(
          {
            label:
              "PCGamingWiki data loaded",

            detail:
              game.pcgwPageName
                ?? game.pcgwPageUrl
                ?? "No PCGamingWiki page is currently loaded.",

            state:
              game.pcgwLoaded
                && !game.pcgwError
                ? "pass"
                : "neutral",
          }
        );

        list.push(
          {
            label:
              "Configuration path available",

            detail:
              game.technical
                ?.configLocation
                ?? "No configuration location reported.",

            state:
              game.technical
                ?.configLocation
                ? "pass"
                : "neutral",

            actionLabel:
              game.technical
                ?.configLocation
                ? "Open"
                : null,

            onAction:
              game.technical
                ?.configLocation
                ? () =>
                    handleOpenPath(
                      game.technical
                        ?.configLocation
                    )
                : null,
          }
        );

        list.push(
          {
            label:
              "Save path available",

            detail:
              game.technical
                ?.saveLocation
                ?? "No save location reported.",

            state:
              game.technical
                ?.saveLocation
                ? "pass"
                : "neutral",

            actionLabel:
              game.technical
                ?.saveLocation
                ? "Open"
                : null,

            onAction:
              game.technical
                ?.saveLocation
                ? () =>
                    handleOpenPath(
                      game.technical
                        ?.saveLocation
                    )
                : null,
          }
        );

        list.push(
          {
            label:
              "Save backup created",

            detail:
              backups?.backupCount
                ? `${backups.backupCount} backup${backups.backupCount === 1 ? "" : "s"} available.`
                : "No GameAtlas save backup has been created yet.",

            state:
              backups?.backupCount
                > 0
                ? "pass"
                : game.technical
                    ?.saveLocation
                  ? "warn"
                  : "neutral",

            actionLabel:
              game.technical
                ?.saveLocation
                && !(backups?.backupCount > 0)
                ? "Create Backup"
                : null,

            onAction:
              handleCreateBackup,

            actionBusy:
              backupBusy,
          }
        );

        const hdrEnhancementAvailable =
          Boolean(
            game.renodx
              ?.renodx
              ?.available
            || game.renodx
              ?.luma
              ?.available
          );

        list.push(
          {
            label:
              "HDR enhancement availability checked",

            detail:
              hdrEnhancementAvailable
                ? "RenoDX or Luma enhancement is available for this game."
                : "No RenoDX/Luma enhancement is currently marked available.",

            state:
              game.renodxLoaded
                ? "pass"
                : "neutral",
          }
        );

        list.push(
          {
            label:
              "Local graphics technologies inspected",

            detail:
              local
                ? [
                    local.graphics
                      ?.dlss
                      ? "DLSS"
                      : null,

                    local.graphics
                      ?.dlssFrameGeneration
                      ? "DLSS Frame Generation"
                      : null,

                    local.graphics
                      ?.xess
                      ? "XeSS"
                      : null,

                    local.graphics
                      ?.fsr
                      ? "FSR"
                      : null,
                  ]
                  .filter(
                    Boolean
                  )
                  .join(
                    ", "
                  )
                  || "No recognized upscaling DLLs detected."
                : "Local installation has not been inspected.",

            state:
              local
                ? "pass"
                : "neutral",
          }
        );

        list.push(
          {
            label:
              "ReShade status inspected",

            detail:
              local?.reshade
                ?.installed
                ? `ReShade detected${local.reshade.proxyDll ? ` (${local.reshade.proxyDll})` : ""}.`
                : "ReShade not detected.",

            state:
              local
                ? "pass"
                : "neutral",
          }
        );

        return list;
      },
      [
        game,
        local,
        backups,
        backupBusy,
      ]
    );


  const scoredChecks =
    checks.filter(
      (check) =>
        check.state
        !== "neutral"
    );

  const passedChecks =
    scoredChecks.filter(
      (check) =>
        check.state
        === "pass"
    ).length;

  const score =
    scoredChecks.length
      ? Math.round(
          (
            passedChecks
            / scoredChecks.length
          )
          * 100
        )
      : 0;

  const grade =
    gradeFromScore(
      score
    );

  const warningChecks =
    checks.filter(
      (check) =>
        check.state === "warn"
    );

  const informationalChecks =
    checks.filter(
      (check) =>
        check.state === "neutral"
    );

  const actionableChecks =
    warningChecks.filter(
      (check) =>
        Boolean(
          check.actionLabel
        )
    );

  useEffect(
    () => {
      if (
        loading
        || !game
      ) {
        return;
      }

      storeInstallationHealth(
        game,
        {
          score,
          passed:
            passedChecks,
          warnings:
            warningChecks.length,
          informational:
            informationalChecks.length,
          actionable:
            actionableChecks.length,
        }
      );
    },
    [
      game?.id,
      loading,
      score,
      passedChecks,
      warningChecks.length,
      informationalChecks.length,
      actionableChecks.length,
    ]
  );

  const summaryText =
    warningChecks.length > 0
      ? `${warningChecks.length} item${warningChecks.length === 1 ? "" : "s"} need attention.${actionableChecks.length > 0 ? ` ${actionableChecks.length} can be acted on directly below.` : ""}`
      : "No scored setup issues are currently detected.";


  return (
    <div
      className="
        space-y-4
      "
    >
      <div
        className="
          flex
          flex-col
          gap-4
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <div>
          <div
            className="
              flex
              items-center
              gap-2
              text-sm
              font-semibold
              text-white/72
            "
          >
            <HeartPulse
              className="
                h-4
                w-4
                text-cyan-300/80
              "
            />

            Installation Health
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/30
            "
          >
            {summaryText}
          </div>
        </div>

        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <div
            className={`
              rounded-lg
              border
              px-3
              py-2
              text-center
              ${grade.className}
            `}
          >
            <div
              className="
                text-lg
                font-bold
              "
            >
              {score}%
            </div>

            <div
              className="
                text-[10px]
                font-semibold
                uppercase
                tracking-wide
                opacity-70
              "
            >
              {grade.label}
            </div>
          </div>

          <button
            type="button"
            onClick={
              refresh
            }
            disabled={
              loading
            }
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.025]
              text-white/40
              hover:bg-white/[0.06]
              hover:text-white/70
              disabled:opacity-30
            "
            title="Refresh health checks"
          >
            {loading ? (
              <Loader2
                className="
                  h-4
                  w-4
                  animate-spin
                "
              />
            ) : (
              <RefreshCcw
                className="h-4 w-4"
              />
            )}
          </button>
        </div>

        <div
          className="
            mt-4
            grid
            grid-cols-3
            gap-2
          "
        >
          <div className="rounded-lg bg-emerald-500/[0.05] px-3 py-2">
            <div className="text-lg font-bold text-emerald-200/80">
              {passedChecks}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-white/25">
              Verified
            </div>
          </div>

          <div className="rounded-lg bg-amber-500/[0.05] px-3 py-2">
            <div className="text-lg font-bold text-amber-200/80">
              {warningChecks.length}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-white/25">
              Attention
            </div>
          </div>

          <div className="rounded-lg bg-white/[0.025] px-3 py-2">
            <div className="text-lg font-bold text-white/55">
              {informationalChecks.length}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-white/25">
              Informational
            </div>
          </div>
        </div>
      </div>


      {actionMessage ? (
        <div
          className="
            rounded-xl
            border
            border-cyan-500/15
            bg-cyan-500/[0.04]
            px-4
            py-3
            text-xs
            text-cyan-100/65
          "
        >
          {actionMessage}
        </div>
      ) : null}


      {warningChecks.length > 0 ? (
        <div
          className="
            rounded-xl
            border
            border-amber-500/15
            bg-amber-500/[0.035]
            p-4
          "
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200/70">
            <Wrench className="h-3.5 w-3.5" />
            Recommended Next Steps
          </div>

          <div className="mt-2 space-y-1 text-xs text-white/38">
            {warningChecks
              .slice(0, 3)
              .map(
                (check) => (
                  <div key={check.label}>
                    • {check.label}
                  </div>
                )
              )}
          </div>
        </div>
      ) : null}


      {error ? (
        <div
          className="
            rounded-xl
            border
            border-amber-500/20
            bg-amber-500/[0.05]
            px-4
            py-3
            text-xs
            text-amber-200/70
          "
        >
          Local inspection warning: {error}
        </div>
      ) : null}


      <div
        className="
          overflow-hidden
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
        "
      >
        {checks.map(
          (
            check,
            index
          ) => (
            <HealthCheck
              key={
                `${check.label}-${index}`
              }
              {...check}
            />
          )
        )}
      </div>

      <div
        className="
          text-[11px]
          leading-relaxed
          text-white/24
        "
      >
        Installation Health measures setup completeness using checks GameAtlas can verify. It is not a diagnosis of whether a game is broken.
        Neutral checks are informational and do not reduce the score.
      </div>
    </div>
  );
}
