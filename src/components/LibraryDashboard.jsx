import {
  Activity,
  ChevronRight,
  Gamepad2,
  HeartPulse,
  LoaderCircle,
  Play,
  Star,
  TriangleAlert,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import { getRecentLibraryLaunches } from "../services/recentActivity";
import { getGameFallbackInitial } from "../services/gameArtwork";
import { useGameArtwork } from "../services/useGameListArtwork";
import { formatRelativeDay } from "../services/relativeTime";
import { launchDefaultProfile } from "../services/launchProfiles";
import { error as logError } from "../services/logging";
import { useLibraryOverviewData } from "../services/useLibraryOverviewData";

import {
  healthCategoryLabel,
} from "../services/installationHealth";

import {
  isLibraryAnalysisRunning,
  LibraryActivityBanner,
} from "./LibraryToolsScreen";


const RECENT_GAME_LIMIT = 6;


function gameKeyOf(game) {
  return game.id ?? `${game.store}-${game.launcherId}-${game.name}`;
}


function openLibraryTools(focus = {}) {
  window.dispatchEvent(new CustomEvent("game-manager-open-library-tools", {
    detail: focus,
  }));
}


// The default profile is implied; only call out launches that used another one.
function launchProfileNote(entry) {
  const name = entry?.profileName;
  return name && name !== "Normal" ? `${name} profile` : null;
}


function Poster({ game, url, onError, className = "" }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-white/[0.04] text-cyan-300/60 ${className}`} aria-hidden="true">
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" draggable={false} onError={() => onError(url)} className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl font-bold">{getGameFallbackInitial(game)}</span>
      )}
    </span>
  );
}


function GameThumb({ game }) {
  const { elementRef, posterUrl, markFailed } = useGameArtwork(game);

  return (
    <span ref={elementRef} className="shrink-0">
      <Poster game={game} url={posterUrl} onError={markFailed} className="h-14 w-12 rounded-lg" />
    </span>
  );
}


function PlayButton({ game, launching, onPlay, large = false }) {
  const iconClass = large ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={() => onPlay(game)}
      disabled={launching}
      aria-label={`Play ${game.name}`}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 font-semibold text-[#06121a] transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${large ? "px-5 py-2.5 text-sm" : "px-3 py-1.5 text-xs"}`}
    >
      {launching ? (
        <LoaderCircle className={`${iconClass} animate-spin`} />
      ) : (
        <Play className={`${iconClass} fill-current`} />
      )}
      {launching ? "Launching…" : "Play"}
    </button>
  );
}


function FeaturedGame({ game, entry, launching, launchError, onPlay, onOpen }) {
  const { elementRef, heroUrl, posterUrl, markFailed } = useGameArtwork(game);
  const backdropUrl = heroUrl ?? posterUrl;
  const note = launchProfileNote(entry);

  return (
    <div ref={elementRef} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => markFailed(backdropUrl)}
          className={`absolute inset-0 h-full w-full object-cover ${heroUrl ? "opacity-50" : "scale-110 opacity-30 blur-2xl"}`}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f17] via-[#0b0f17]/85 to-[#0b0f17]/20" />

      <div className="relative flex items-end gap-5 p-5 sm:p-6">
        <button type="button" onClick={() => onOpen(game)} className="hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:block" aria-label={`Open ${game.name}`}>
          <Poster game={game} url={posterUrl} onError={markFailed} className="h-44 w-[118px] rounded-xl shadow-lg shadow-black/40" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200/70">Continue playing</div>
          <h3 className="mt-1 line-clamp-2 text-2xl font-bold text-white xl:text-3xl" title={game.name}>{game.name}</h3>
          <div className="mt-1.5 text-sm text-white/60">
            Last launched {formatRelativeDay(entry.launchedAt)}{note ? ` · ${note}` : ""}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <PlayButton game={game} launching={launching} onPlay={onPlay} large />
            <button type="button" onClick={() => onOpen(game)} className="rounded-lg border border-white/15 bg-black/20 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              Game details
            </button>
          </div>

          {launchError ? <p className="mt-3 text-xs text-red-200/90" role="alert">{launchError}</p> : null}
        </div>
      </div>
    </div>
  );
}


function RecentGameCard({ game, entry, launching, launchError, onPlay, onOpen }) {
  const { elementRef, posterUrl, markFailed } = useGameArtwork(game);
  const note = launchProfileNote(entry);

  return (
    <div ref={elementRef} className="flex min-w-0 flex-col">
      <button type="button" onClick={() => onOpen(game)} className="group rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" aria-label={`Open ${game.name}`}>
        <Poster game={game} url={posterUrl} onError={markFailed} className="aspect-[2/3] w-full rounded-xl transition group-hover:border-cyan-300/40" />
      </button>
      <div className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-white/85" title={game.name}>{game.name}</div>
      <div className="mt-0.5 truncate text-xs text-white/45">
        {formatRelativeDay(entry.launchedAt)}{note ? ` · ${note}` : ""}
      </div>
      <div className="mt-2">
        <PlayButton game={game} launching={launching} onPlay={onPlay} />
      </div>
      {launchError ? <p className="mt-1.5 text-[11px] text-red-200/90" role="alert">{launchError}</p> : null}
    </div>
  );
}


function StatTile({
  icon: Icon,
  label,
  value,
  detail,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group rounded-xl border border-white/[0.08] bg-black/10 p-4 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.03] disabled:cursor-default disabled:hover:border-white/[0.08] disabled:hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/40">
        <Icon className="h-4 w-4 text-cyan-300/70" />
        <span className="flex-1">{label}</span>
        {disabled ? null : <ChevronRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-cyan-200/70" />}
      </div>

      <div className="mt-3 text-2xl font-bold text-white/80">
        {value}
      </div>

      {detail ? (
        <div className="mt-1 text-xs text-white/45">
          {detail}
        </div>
      ) : null}
    </button>
  );
}


export default function LibraryDashboard({
  games = [],
  hiddenGameIds = [],
  onAnalyzeRemaining,
  onRefreshStale,
  libraryAnalysis,
  onCancelLibraryAnalysis,
  onRescanLibrary,
  libraryScanLoading = false,
  onSelectGame,
  networkOnline = true,
}) {
  const {
    data,
    storeRows,
    revision,
  } =
    useLibraryOverviewData(
      games,
      libraryAnalysis
    );

  const [launchingKey, setLaunchingKey] = useState(null);
  const [launchError, setLaunchError] = useState(null);

  const hiddenIds = useMemo(() => new Set(hiddenGameIds), [hiddenGameIds]);
  const isVisible = (game) => !hiddenIds.has(game.id);
  const hiddenCount = data.games.length - data.games.filter(isVisible).length;

  const recentGames = useMemo(
    () => getRecentLibraryLaunches(data.games.filter(isVisible), RECENT_GAME_LIMIT),
    [data.games, hiddenIds, revision]
  );
  const [featured, ...shelf] = recentGames;

  const attentionGames = data.health.rows
    .filter(({ game, record }) => isVisible(game) && record && ["needs-attention", "incomplete"].includes(record.category))
    .sort((left, right) => (right.record.actionable + right.record.warnings) - (left.record.actionable + left.record.warnings))
    .slice(0, 3);

  const analysisRunning = isLibraryAnalysisRunning(libraryAnalysis);
  const showStaleData = data.analysis.stale > 0;
  const showPartialData = !showStaleData && data.analysis.partial > 0;
  const dataNoteCount = showStaleData ? data.analysis.stale : data.analysis.partial;

  async function playGame(game) {
    const key = gameKeyOf(game);

    setLaunchingKey(key);
    setLaunchError(null);

    try {
      await launchDefaultProfile(game);
    } catch (error) {
      logError("[Launch] Failed:", error);
      setLaunchError({ key, message: String(error) });
    } finally {
      setLaunchingKey(null);
    }
  }

  function cardProps(game, entry) {
    const key = gameKeyOf(game);

    return {
      game,
      entry,
      launching: launchingKey === key,
      launchError: launchError?.key === key ? launchError.message : null,
      onPlay: playGame,
      onOpen: (selected) => onSelectGame?.(selected),
    };
  }

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
            flex-col
            gap-4
            sm:flex-row
            sm:items-center
            sm:justify-between
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
                Your Library
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                  text-white/35
                "
              >
                Pick up where you left off and keep your games in good shape.
              </p>
            </div>
          </div>

          <div
            className={`
              inline-flex
              w-fit
              items-center
              gap-2
              rounded-full
              border
              px-3
              py-1.5
              text-xs
              font-semibold
              ${
                networkOnline
                  ? "border-emerald-500/15 bg-emerald-500/[0.05] text-emerald-200/65"
                  : "border-amber-500/20 bg-amber-500/[0.07] text-amber-200/80"
              }
            `}
          >
            {networkOnline ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}

            {networkOnline
              ? "Online"
              : "Offline Mode"}
          </div>
        </div>


        {!networkOnline ? (
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
            border-amber-500/20
            bg-amber-500/[0.05]
          `}
        >
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" />

          <div>
            <div className="text-xs font-semibold text-amber-100/75">
              Remote features are paused
            </div>

            <div className="mt-0.5 text-[11px] leading-relaxed text-white/30">
              Installed games, cached analysis, health checks, backups, local inspection,
              filters, and launcher actions remain available.
            </div>
          </div>
        </div>
        ) : null}


        <section className="mt-7" aria-labelledby="recent-games-title">
          {featured ? (
            <>
              <h2 id="recent-games-title" className="sr-only">Continue playing</h2>
              <FeaturedGame {...cardProps(featured.game, featured.entry)} />

              {shelf.length > 0 ? (
                <div className="mt-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-semibold text-white/75">Recently played</h3>
                    <span className="text-[11px] text-white/35">Launches through GameAtlas</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {shelf.map(({ game, entry }) => (
                      <RecentGameCard key={gameKeyOf(game)} {...cardProps(game, entry)} />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 id="recent-games-title" className="text-lg font-semibold text-white/85">{data.total === 0 ? "Welcome to GameAtlas" : "Continue playing"}</h2>
              <div className="mt-4 rounded-xl border border-dashed border-white/10 p-5 text-sm text-white/55">
                {data.total === 0 ? (
                  <>
                    <div className="font-semibold text-white/75">Build your library</div>
                    <p className="mt-1">Add a game manually or scan installed games to get started.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => window.dispatchEvent(new Event("game-manager-open-add-game"))} className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20">Add a game</button>
                      <button type="button" onClick={onRescanLibrary} disabled={libraryScanLoading} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.05] disabled:opacity-40">Scan installed games</button>
                    </div>
                  </>
                ) : "Pick a game from the sidebar and press Play. Games you launch through GameAtlas show up here."}
              </div>
            </div>
          )}
        </section>


        <LibraryActivityBanner
          libraryAnalysis={libraryAnalysis}
          libraryScanLoading={libraryScanLoading}
          onCancelLibraryAnalysis={onCancelLibraryAnalysis}
        />


        {!analysisRunning && (showStaleData || showPartialData) ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-white/45">
            <Activity className="h-3.5 w-3.5 shrink-0 text-white/35" />
            <span>
              {dataNoteCount} {dataNoteCount === 1 ? "game has" : "games have"} {showStaleData ? "out-of-date" : "incomplete"} info from PCGamingWiki and mod sources.
            </span>
            {networkOnline ? (
              <button type="button" onClick={showStaleData ? onRefreshStale : onAnalyzeRemaining} className="font-semibold text-cyan-200/80 underline-offset-2 hover:text-cyan-100 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
                {showStaleData ? "Refresh now" : "Retry"}
              </button>
            ) : (
              <span>It will refresh when you are back online.</span>
            )}
          </div>
        ) : null}


        {attentionGames.length > 0 ? <section className="mt-7 rounded-2xl border border-amber-400/15 bg-amber-400/[0.025] p-5" aria-labelledby="attention-title">
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-300/80" />
            <h2 id="attention-title" className="text-lg font-semibold text-white/85">Needs your attention</h2>
          </div>
          <div className="mt-4 space-y-2">
            {attentionGames.map(({ game, record }) => (
              <div key={gameKeyOf(game)} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-black/10 p-3 sm:flex-nowrap">
                <GameThumb game={game} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white/80">{game.name}</div>
                  <div className="text-xs text-white/55">Health check: {record.score}% · {healthCategoryLabel(record.category)}</div>
                </div>
                <button type="button" onClick={() => onSelectGame?.(game, { focus: "health" })} className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200">Review Health</button>
              </div>
            ))}
          </div>
        </section> : null}


        {data.total > 0 ? <>
        <h2 className="mt-8 text-base font-semibold text-white/75">Library snapshot</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            icon={Gamepad2}
            label="Installed"
            value={data.total}
            detail={[
              `${storeRows.length} storefront${storeRows.length === 1 ? "" : "s"}`,
              hiddenCount > 0 ? `${hiddenCount} hidden` : null,
            ].filter(Boolean).join(" · ")}
            onClick={() => openLibraryTools({ section: "dashboard-library-insights" })}
          />

          <StatTile
            icon={Activity}
            label="Info up to date"
            value={`${data.analysis.coverage}%`}
            detail={`${data.analysis.full} of ${data.analysis.total} games`}
            onClick={() => openLibraryTools({ section: "dashboard-data-analysis" })}
          />

          <StatTile
            icon={HeartPulse}
            label="Health checked"
            value={`${data.health.assessed}/${data.health.total}`}
            detail={data.health.unassessed > 0 ? `${data.health.unassessed} not checked yet` : "Every game checked"}
            onClick={() => openLibraryTools({
              section: "dashboard-health-checks",
              healthFilter: data.health.unassessed > 0 ? "unassessed" : null,
            })}
          />

          <StatTile
            icon={Star}
            label="Favorites"
            value={data.favorites}
            detail={data.favorites > 0 ? "Show in sidebar" : "Star a game to add it"}
            disabled={data.favorites === 0}
            onClick={() => window.dispatchEvent(new Event("game-manager-show-favorites"))}
          />
        </div>
        </> : null}


        <button
          type="button"
          onClick={() => openLibraryTools()}
          className="group mb-10 mt-6 flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-left transition hover:border-white/[0.15] hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          <Wrench className="h-4 w-4 shrink-0 text-cyan-300/70" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white/75">Library tools</span>
            <span className="block text-xs text-white/40">Game data analysis, health checks, install-path scan, insights, services, and app info</span>
          </span>
          <ChevronRight className="h-4 w-4 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-cyan-200/70" />
        </button>
      </div>
    </main>
  );
}
