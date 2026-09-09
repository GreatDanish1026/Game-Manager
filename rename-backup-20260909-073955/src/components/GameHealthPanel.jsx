import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  HeartPulse,
  Loader2,
  RefreshCcw,
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
  getSaveBackupStatus,
} from "../services/saveBackups";


function HealthCheck({
  label,
  detail,
  state,
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
          }
        );

        list.push(
          {
            label:
              "Save backup created",

            detail:
              backups?.backupCount
                ? `${backups.backupCount} backup${backups.backupCount === 1 ? "" : "s"} available.`
                : "No Game Manager save backup has been created yet.",

            state:
              backups?.backupCount
                > 0
                ? "pass"
                : game.technical
                    ?.saveLocation
                  ? "warn"
                  : "neutral",
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
            A readiness checklist based on information Game Manager can verify.
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
      </div>


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
        The health score is a setup-readiness indicator, not a diagnosis of whether a game is broken.
        Neutral checks are informational and do not reduce the score.
      </div>
    </div>
  );
}
