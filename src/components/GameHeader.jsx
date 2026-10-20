import {
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Cpu,
  FolderOpen,
  LoaderCircle,
  Play,
  Settings2,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import StoreBadge from "./StoreBadge";
import QuickStatusBar from "./QuickStatusBar";
import GameStatusRow from "./GameStatusRow";

import { error as logError } from "../services/logging";
import { openGamePath } from "../services/pathActions";
import { getGameCoverArt, getGameFallbackInitial } from "../services/gameArtwork";
import { useGameArtwork } from "../services/useGameListArtwork";
import { getRecentLibraryLaunches } from "../services/recentActivity";
import { formatRelativeDay } from "../services/relativeTime";
import { openGameSection } from "../services/gameSections";
import {
  getLaunchProfileState,
  launchConfiguredProfile,
  launchDefaultProfile,
} from "../services/launchProfiles";


function Fact({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-white/35" />
      {children}
    </span>
  );
}


function useLastLaunch(game) {
  const read = () => getRecentLibraryLaunches([game], 1)[0]?.entry ?? null;
  const [entry, setEntry] = useState(read);

  useEffect(() => {
    const refresh = () => setEntry(getRecentLibraryLaunches([game], 1)[0]?.entry ?? null);
    refresh();
    window.addEventListener("game-manager-launch-history-changed", refresh);
    return () => window.removeEventListener("game-manager-launch-history-changed", refresh);
  }, [game?.id]);

  return entry;
}


function PlayMenu({ game, disabled, onLaunchProfile, onClose }) {
  const menuRef = useRef(null);
  const state = getLaunchProfileState(game);

  useEffect(() => {
    function handlePointer(event) {
      if (!menuRef.current?.parentElement?.contains(event.target)) onClose();
    }

    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    menuRef.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const itemClass = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/[0.07] focus-visible:bg-white/[0.07] focus-visible:outline-none disabled:opacity-40";

  return (
    <div ref={menuRef} role="menu" className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-white/10 bg-[#121a26] p-1.5 shadow-2xl shadow-black/50">
      <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/35">Launch with profile</div>
      {state.profiles.map((profile) => (
        <button key={profile.id} type="button" role="menuitem" disabled={disabled} onClick={() => onLaunchProfile(profile)} className={itemClass}>
          <Play className="h-3.5 w-3.5 shrink-0 text-cyan-300/80" />
          <span className="min-w-0 flex-1 truncate">{profile.name}</span>
          {profile.id === state.defaultProfileId ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/40"><Check className="h-3 w-3" />Default</span>
          ) : null}
        </button>
      ))}
      <div className="my-1.5 border-t border-white/[0.07]" />
      <button type="button" role="menuitem" onClick={() => { onClose(); openGameSection("technical-troubleshooting", "diagnostic-clean-launch"); }} className={itemClass}>
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-white/45" />
        Clean launch…
      </button>
      <button type="button" role="menuitem" onClick={() => { onClose(); openGameSection("compatibility-performance", "game-launch-profiles"); }} className={itemClass}>
        <Settings2 className="h-3.5 w-3.5 shrink-0 text-white/45" />
        Manage launch profiles
      </button>
    </div>
  );
}


export default function GameHeader({
  game,
  networkOnline = true,
}) {
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [pathError, setPathError] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [failedCovers, setFailedCovers] = useState([]);

  const { elementRef, heroUrl, posterUrl, markFailed } = useGameArtwork(game);
  const explicitCover = getGameCoverArt(game);
  const pcgwCover = failedCovers.includes(explicitCover) ? null : explicitCover;
  const coverUrl = pcgwCover ?? posterUrl;
  const backdropUrl = heroUrl ?? coverUrl;
  const lastLaunch = useLastLaunch(game);

  const engine = [game.technical?.engine, game.technical?.api].filter(Boolean).join(" · ");

  async function launch(start) {
    setMenuOpen(false);
    setLaunching(true);
    setLaunchError(null);

    try {
      await start();
    } catch (error) {
      logError("[Launch] Failed:", error);
      setLaunchError(String(error));
    } finally {
      setLaunching(false);
    }
  }

  async function openInstallFolder() {
    setPathError(null);

    try {
      await openGamePath(game.installPath, game.installPath);
    } catch (error) {
      logError("[Paths] Failed to open:", error);
      setPathError(String(error));
    }
  }

  function handleCoverError(url) {
    if (url === pcgwCover) {
      setFailedCovers((current) => [...current, url]);
    } else {
      markFailed(url);
    }
  }

  const secondaryButton = "inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/25 px-4 py-2.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition hover:bg-white/[0.08] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300";

  return (
    <section ref={elementRef} className="relative mb-6 rounded-2xl border border-white/[0.08] bg-black/20">
      {/* Artwork is clipped in its own layer so the launch menu can overflow the card. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => handleCoverError(backdropUrl)}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${heroUrl ? "opacity-40" : "scale-110 opacity-25 blur-2xl"}`}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0f17] via-[#0b0f17]/90 to-[#0b0f17]/40" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0b0f17]/80 to-transparent" />
      </div>

      <div className="relative p-5 sm:p-7">
        <div className="flex gap-6">
          <div className="hidden shrink-0 sm:block">
            <span className="flex h-[210px] w-[140px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-4xl font-bold text-cyan-300/60 shadow-2xl shadow-black/40 xl:h-[240px] xl:w-[160px]">
              {coverUrl ? (
                <img src={coverUrl} alt={`${game.name} cover`} referrerPolicy="no-referrer" draggable={false} onError={() => handleCoverError(coverUrl)} className="h-full w-full object-cover" />
              ) : (
                getGameFallbackInitial(game)
              )}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <StoreBadge store={game.store} />

            <h1 className="mt-2.5 break-words text-3xl font-bold tracking-tight text-white xl:text-4xl">
              {game.name}
            </h1>

            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/55">
              {game.developer ? <Fact icon={UserRoundCog}>{game.developer}</Fact> : null}
              {game.releaseDate ? <Fact icon={CalendarDays}>{game.releaseDate}</Fact> : null}
              {engine ? <Fact icon={Cpu}>{engine}</Fact> : null}
              <Fact icon={Clock3}>{lastLaunch ? `Last played ${formatRelativeDay(lastLaunch.launchedAt)}` : "Not launched from GameAtlas yet"}</Fact>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="relative inline-flex">
                <button
                  type="button"
                  onClick={() => launch(() => launchDefaultProfile(game))}
                  disabled={launching}
                  title={`Launch through ${game.store}`}
                  className="inline-flex items-center gap-2 rounded-l-xl bg-cyan-400 px-6 py-2.5 text-sm font-bold text-[#06121a] transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                >
                  {launching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                  {launching ? "Launching…" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="More launch options"
                  className="inline-flex items-center rounded-r-xl border-l border-[#06121a]/20 bg-cyan-400 px-2.5 text-[#06121a] transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                >
                  <ChevronDown className={`h-4 w-4 transition ${menuOpen ? "rotate-180" : ""}`} />
                </button>
                {menuOpen ? (
                  <PlayMenu
                    game={game}
                    disabled={launching}
                    onLaunchProfile={(profile) => launch(() => launchConfiguredProfile(game, profile))}
                    onClose={() => setMenuOpen(false)}
                  />
                ) : null}
              </div>

              <button type="button" onClick={openInstallFolder} disabled={!game.installPath} className={secondaryButton}>
                <FolderOpen className="h-4 w-4" />
                Open folder
              </button>

              <button type="button" onClick={() => openGameSection("saves-screenshots", "game-save-backups")} className={secondaryButton}>
                <Archive className="h-4 w-4" />
                Save backups
              </button>
            </div>

            {launchError || pathError ? (
              <div className="mt-3 max-w-2xl rounded-xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-3 text-xs leading-relaxed text-amber-100/80" role="alert">
                {launchError ?? pathError}
              </div>
            ) : null}

            <QuickStatusBar game={game} />
          </div>
        </div>

        <GameStatusRow game={game} networkOnline={networkOnline} />
      </div>
    </section>
  );
}
