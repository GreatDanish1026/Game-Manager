import {
  Activity,
  CheckCircle2,
  Clock3,
  HeartPulse,
  Gamepad2,
  MonitorUp,
  Puzzle,
  RefreshCcw,
  Star,
  Store,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getLibraryInsights,
  getLibrarySnapshot,
} from "../services/libraryInsights";

import {
  getLibraryAnalysisSummary,
} from "../services/analysisState";

import {
  getSettings,
} from "../services/settings";

import {
  getGameUserMetadata,
} from "../services/userGameMetadata";

import {
  getInstallationHealthSummary,
  healthCategoryLabel,
} from "../services/installationHealth";

import AboutCard from "./AboutCard";
import ExternalServiceStatusPanel from "./ExternalServiceStatusPanel";
import LauncherStatusPanel from "./LauncherStatusPanel";


function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
        p-4
      "
    >
      <div
        className="
          flex
          items-center
          gap-2
          text-xs
          font-semibold
          uppercase
          tracking-wide
          text-white/30
        "
      >
        <Icon
          className="
            h-4
            w-4
            text-cyan-300/70
          "
        />

        {label}
      </div>

      <div
        className="
          mt-3
          text-2xl
          font-bold
          text-white/78
        "
      >
        {value}
      </div>

      {detail ? (
        <div
          className="
            mt-1
            text-xs
            text-white/25
          "
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}


function CountRow({
  label,
  value,
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        border-b
        border-white/[0.055]
        px-4
        py-2.5
        last:border-b-0
      "
    >
      <span
        className="
          text-sm
          text-white/45
        "
      >
        {label}
      </span>

      <span
        className="
          text-sm
          font-semibold
          tabular-nums
          text-white/70
        "
      >
        {value}
      </span>
    </div>
  );
}


function AnalysisStateRow({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}) {
  const toneClass =
    {
      good:
        "text-emerald-300/75 bg-emerald-500/[0.06]",
      warning:
        "text-amber-300/75 bg-amber-500/[0.06]",
      stale:
        "text-orange-300/75 bg-orange-500/[0.06]",
      neutral:
        "text-white/45 bg-white/[0.025]",
    }[
      tone
    ];

  return (
    <div
      className={`
        flex
        items-center
        gap-3
        rounded-xl
        px-3
        py-3
        ${toneClass}
      `}
    >
      <Icon
        className="
          h-4
          w-4
          shrink-0
        "
      />

      <div
        className="
          min-w-0
          flex-1
        "
      >
        <div
          className="
            text-xs
            font-semibold
          "
        >
          {label}
        </div>

        <div
          className="
            mt-0.5
            text-[10px]
            opacity-55
          "
        >
          {detail}
        </div>
      </div>

      <div
        className="
          text-lg
          font-bold
          tabular-nums
          text-white/80
        "
      >
        {value}
      </div>
    </div>
  );
}


export default function LibraryDashboard({
  games = [],
  onAnalyzeRemaining,
  onRefreshStale,
  libraryAnalysis,
  onCheckForUpdates,
  updateCheckStatus,
  onSelectGame,
  networkOnline = true,
}) {
  const [
    revision,
    setRevision,
  ] =
    useState(0);

  const [
    healthFilter,
    setHealthFilter,
  ] =
    useState(null);

  useEffect(
    () => {
      const refresh =
        () =>
          setRevision(
            (value) =>
              value + 1
          );

      const events = [
        "game-manager-library-insights-changed",
        "game-manager-library-snapshot-changed",
        "game-manager-user-metadata-changed",
        "game-manager-analysis-state-changed",
        "game-manager-settings-changed",
        "game-manager-installation-health-changed",
        "storage",
      ];

      events.forEach(
        (event) =>
          window.addEventListener(
            event,
            refresh
          )
      );

      return () =>
        events.forEach(
          (event) =>
            window.removeEventListener(
              event,
              refresh
            )
        );
    },
    []
  );

  const data =
    useMemo(
      () => {
        const snapshot =
          getLibrarySnapshot();

        const snapshotGames =
          Object.values(
            snapshot.games
            ?? {}
          );

        const installedGames =
          games.length > 0
            ? games
            : snapshotGames;

        const insights =
          Object.values(
            getLibraryInsights()
          );

        const stores =
          installedGames.reduce(
            (
              result,
              game
            ) => {
              const store =
                game.store
                ?? "Unknown";

              result[store] =
                (
                  result[store]
                  ?? 0
                ) + 1;

              return result;
            },
            {}
          );

        const count =
          (predicate) =>
            insights.filter(
              predicate
            ).length;

        const settings =
          getSettings();

        const analysis =
          getLibraryAnalysisSummary(
            installedGames,
            settings
              .analysisFreshDays
          );

        const health =
          getInstallationHealthSummary(
            installedGames
          );

        return {
          total:
            installedGames.length,

          indexed:
            installedGames.length,

          analyzed:
            insights.length,

          favorites:
            installedGames.filter(
              (game) =>
                getGameUserMetadata(
                  game
                ).favorite
            ).length,

          stores,

          analysis,

          health,

          hdr:
            count(
              (row) =>
                row.hdr === true
            ),

          rayTracing:
            count(
              (row) =>
                row.rayTracing === true
            ),

          frameGeneration:
            count(
              (row) =>
                row.frameGeneration === true
            ),

          ultrawide:
            count(
              (row) =>
                row.ultrawide === true
            ),

          renodx:
            count(
              (row) =>
                row.renodx
            ),

          luma:
            count(
              (row) =>
                row.luma
            ),

          vortex:
            count(
              (row) =>
                row.vortex
            ),

          fluffy:
            count(
              (row) =>
                row.fluffy
            ),
        };
      },
      [
        games,
        revision,
        libraryAnalysis
          ?.state,
        libraryAnalysis
          ?.completed,
      ]
    );

  const storeRows =
    Object.entries(
      data.stores
    )
      .sort(
        (
          left,
          right
        ) =>
          right[1]
          - left[1]
      );

  const analysisRunning =
    libraryAnalysis?.state ===
      "running"
    ||
    libraryAnalysis?.state ===
      "cancelling";

  const healthFilteredGames =
    healthFilter
      ? data.health.rows.filter(
          ({ record }) =>
            healthFilter === "unassessed"
              ? !record
              : record?.category === healthFilter
        )
      : [];

  return (
    <main
      className="
        min-w-0
        flex-1
        overflow-y-auto
        bg-[#0b0f17]
      "
    >
      <div
        className="
          mx-auto
          max-w-6xl
          px-6
          py-8
          lg:px-10
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-cyan-500/10
              text-cyan-300
            "
          >
            <Gamepad2
              className="h-6 w-6"
            />
          </div>

          <div>
            <h1
              className="
                text-2xl
                font-semibold
                text-white
              "
            >
              Library Overview
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-white/35
              "
            >
              Review library coverage, capabilities, and analysis freshness.
            </p>
          </div>
        </div>


        <div
          className={`
            mt-5
            flex
            items-start
            gap-3
            rounded-xl
            border
            px-4
            py-3
            ${
              networkOnline
                ? "border-emerald-500/10 bg-emerald-500/[0.025]"
                : "border-amber-500/20 bg-amber-500/[0.05]"
            }
          `}
        >
          {networkOnline ? (
            <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/65" />
          ) : (
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" />
          )}

          <div>
            <div
              className={`
                text-xs
                font-semibold
                ${
                  networkOnline
                    ? "text-emerald-100/60"
                    : "text-amber-100/75"
                }
              `}
            >
              {networkOnline
                ? "Online"
                : "Offline Mode"}
            </div>

            <div className="mt-0.5 text-[11px] leading-relaxed text-white/30">
              {networkOnline
                ? "Remote analysis and update checks are available."
                : "Remote lookups are paused. Installed games, cached analysis, Installation Health, backups, local inspection, filters, and launcher actions remain available."}
            </div>
          </div>
        </div>


        <div
          className="
            mt-7
            grid
            grid-cols-2
            gap-3
            lg:grid-cols-4
          "
        >
          <StatCard
            icon={
              Gamepad2
            }
            label="Installed"
            value={
              data.total
            }
            detail={`${data.indexed} currently indexed`}
          />

          <StatCard
            icon={
              Activity
            }
            label="Fully Analyzed"
            value={
              data.analysis.full
            }
            detail={`${data.analysis.coverage}% fresh coverage`}
          />

          <StatCard
            icon={
              Star
            }
            label="Favorites"
            value={
              data.favorites
            }
          />

          <StatCard
            icon={
              Store
            }
            label="Stores"
            value={
              storeRows.length
            }
          />
        </div>


        <section
          className="
            mt-6
            rounded-2xl
            border
            border-cyan-500/15
            bg-cyan-500/[0.025]
            p-5
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >
            <div>
              <div
                className="
                  text-base
                  font-semibold
                  text-white/80
                "
              >
                Library Analysis
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  text-white/35
                "
              >
                Fresh coverage is based on your Analysis freshness setting.
              </div>
            </div>

            <div
              className="
                flex
                flex-wrap
                gap-2
              "
            >
              <button
                type="button"
                onClick={
                  onAnalyzeRemaining
                }
                disabled={
                  analysisRunning
                  ||
                  data.analysis
                    .remaining === 0
                }
                className="
                  rounded-lg
                  bg-cyan-500/15
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-cyan-200
                  transition
                  hover:bg-cyan-500/25
                  disabled:cursor-not-allowed
                  disabled:opacity-35
                "
              >
                Analyze Remaining
              </button>

              <button
                type="button"
                onClick={
                  onRefreshStale
                }
                disabled={
                  analysisRunning
                  ||
                  data.analysis
                    .stale === 0
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  border
                  border-white/[0.08]
                  bg-white/[0.025]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-white/55
                  transition
                  hover:bg-white/[0.06]
                  hover:text-white/75
                  disabled:cursor-not-allowed
                  disabled:opacity-35
                "
              >
                <RefreshCcw
                  className="h-3.5 w-3.5"
                />

                Refresh Stale
              </button>
            </div>
          </div>


          <div
            className="
              mt-5
              h-2.5
              overflow-hidden
              rounded-full
              bg-white/[0.055]
            "
          >
            <div
              className="
                h-full
                rounded-full
                bg-cyan-400
                transition-[width]
                duration-300
              "
              style={{
                width:
                  `${data.analysis.coverage}%`,
              }}
            />
          </div>

          <div
            className="
              mt-2
              flex
              items-center
              justify-between
              text-[11px]
              text-white/35
            "
          >
            <span>
              {data.analysis.full} of {data.analysis.total} fully analyzed
            </span>

            <span>
              {data.analysis.coverage}%
            </span>
          </div>


          <div
            className="
              mt-4
              grid
              grid-cols-1
              gap-2
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            <AnalysisStateRow
              icon={
                CheckCircle2
              }
              label="Fully analyzed"
              value={
                data.analysis.full
              }
              detail="Complete and fresh"
              tone="good"
            />

            <AnalysisStateRow
              icon={
                TriangleAlert
              }
              label="Partially analyzed"
              value={
                data.analysis.partial
              }
              detail="One or more sources incomplete"
              tone="warning"
            />

            <AnalysisStateRow
              icon={
                Clock3
              }
              label="Out of date"
              value={
                data.analysis.stale
              }
              detail="Older than freshness setting"
              tone="stale"
            />

            <AnalysisStateRow
              icon={
                Activity
              }
              label="Never analyzed"
              value={
                data.analysis.never
              }
              detail="No analysis record yet"
            />
          </div>
        </section>


        <section
          className="
            mt-6
            rounded-2xl
            border
            border-white/[0.08]
            bg-black/10
            p-5
          "
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
              <HeartPulse className="h-4 w-4" />
            </div>

            <div>
              <div className="text-base font-semibold text-white/80">
                Installation Health
              </div>
              <div className="mt-1 text-xs text-white/35">
                {data.health.assessed} of {data.health.total} games assessed. Click a category to filter.
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
            {[
              ["excellent", "Excellent", data.health.excellent],
              ["good", "Good", data.health.good],
              ["needs-attention", "Needs Attention", data.health["needs-attention"]],
              ["incomplete", "Incomplete", data.health.incomplete],
              ["unassessed", "Not Assessed", data.health.unassessed],
            ].map(([category, label, value]) => (
              <button
                key={category}
                type="button"
                onClick={
                  () =>
                    setHealthFilter(
                      (current) =>
                        current === category
                          ? null
                          : category
                    )
                }
                className={`
                  rounded-xl
                  border
                  p-3
                  text-left
                  transition
                  hover:border-white/[0.15]
                  ${
                    healthFilter === category
                      ? "border-cyan-400/30 bg-cyan-500/[0.06] ring-1 ring-cyan-400/25"
                      : "border-white/[0.08] bg-white/[0.02]"
                  }
                `}
              >
                <div className="text-2xl font-bold text-white/75">
                  {value}
                </div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/30">
                  {label}
                </div>
              </button>
            ))}
          </div>

          {healthFilter ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.07]">
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                <div className="text-xs font-semibold text-white/55">
                  {healthFilter === "unassessed"
                    ? "Not Assessed"
                    : healthCategoryLabel(healthFilter)}
                  {" · "}
                  {healthFilteredGames.length}
                </div>

                <button
                  type="button"
                  onClick={() => setHealthFilter(null)}
                  className="text-[10px] font-semibold text-white/30 hover:text-white/60"
                >
                  Clear
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {healthFilteredGames.length > 0 ? (
                  healthFilteredGames.map(
                    ({ game, record }) => (
                      <button
                        key={
                          game.id
                          ?? `${game.store}-${game.launcherId}-${game.name}`
                        }
                        type="button"
                        onClick={
                          () =>
                            onSelectGame?.(game)
                        }
                        className="flex w-full items-center justify-between gap-4 border-b border-white/[0.045] px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.025]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white/65">
                            {game.name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-white/25">
                            {game.store ?? "Unknown store"}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold text-white/55">
                            {record
                              ? `${record.score}%`
                              : "—"}
                          </div>
                          <div className="text-[9px] uppercase tracking-wide text-white/20">
                            {record
                              ? `${record.warnings} attention`
                              : "Open to assess"}
                          </div>
                        </div>
                      </button>
                    )
                  )
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-white/30">
                    No games are in this category.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>


        <div
          className="
            mt-6
            grid
            grid-cols-1
            gap-4
            xl:grid-cols-3
          "
        >
          <div
            className="
              overflow-hidden
              rounded-xl
              border
              border-white/[0.08]
              bg-black/10
            "
          >
            <div
              className="
                border-b
                border-white/[0.06]
                px-4
                py-3.5
                text-sm
                font-semibold
                text-white/70
              "
            >
              Storefronts
            </div>

            {storeRows.map(
              (
                [
                  store,
                  count,
                ]
              ) => (
                <CountRow
                  key={
                    store
                  }
                  label={
                    store
                  }
                  value={
                    count
                  }
                />
              )
            )}
          </div>

          <div
            className="
              overflow-hidden
              rounded-xl
              border
              border-white/[0.08]
              bg-black/10
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                border-b
                border-white/[0.06]
                px-4
                py-3.5
                text-sm
                font-semibold
                text-white/70
              "
            >
              <MonitorUp
                className="
                  h-4
                  w-4
                  text-cyan-300/70
                "
              />

              Graphics
            </div>

            <CountRow
              label="HDR"
              value={
                data.hdr
              }
            />

            <CountRow
              label="Ray Tracing"
              value={
                data.rayTracing
              }
            />

            <CountRow
              label="Frame Generation"
              value={
                data.frameGeneration
              }
            />

            <CountRow
              label="Ultrawide"
              value={
                data.ultrawide
              }
            />
          </div>

          <div
            className="
              overflow-hidden
              rounded-xl
              border
              border-white/[0.08]
              bg-black/10
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                border-b
                border-white/[0.06]
                px-4
                py-3.5
                text-sm
                font-semibold
                text-white/70
              "
            >
              <Puzzle
                className="
                  h-4
                  w-4
                  text-cyan-300/70
                "
              />

              Mods & Enhancements
            </div>

            <CountRow
              label="RenoDX"
              value={
                data.renodx
              }
            />

            <CountRow
              label="Luma"
              value={
                data.luma
              }
            />

            <CountRow
              label="Vortex"
              value={
                data.vortex
              }
            />

            <CountRow
              label="Fluffy"
              value={
                data.fluffy
              }
            />
          </div>
        </div>


        <div
          className="
            mt-5
          "
        >
          <ExternalServiceStatusPanel
            onCheckForUpdates={
              onCheckForUpdates
            }
            updateCheckStatus={
              updateCheckStatus
            }
          />
        </div>


        <div
          className="
            mt-5
          "
        >
          <LauncherStatusPanel />
        </div>


        <div
          className="
            mt-5
          "
        >
          <AboutCard
            onCheckForUpdates={
              onCheckForUpdates
            }
            updateCheckStatus={
              updateCheckStatus
            }
          />
        </div>


        <div
          className="
            mt-4
            rounded-xl
            border
            border-cyan-500/10
            bg-cyan-500/[0.025]
            p-4
            text-xs
            leading-relaxed
            text-white/30
          "
        >
          Capability counts use analyzed library data. Background analysis tracks
          PCGamingWiki, RenoDX/Luma, and Vortex independently so a failed source
          can be shown as partial instead of making the whole game appear unanalyzed.
        </div>
      </div>
    </main>
  );
}
