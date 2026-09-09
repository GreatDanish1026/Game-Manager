import {
  BadgeCheck,
  CalendarDays,
  Code2,
  Cpu,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Gamepad2,
  HardDrive,
  HeartPulse,
  MonitorCog,
  Info,
  Monitor,
  Package,
  Play,
  LoaderCircle,
  Puzzle,
  Radio,
  Settings2,
  Store,
  TriangleAlert,
  UserRoundCog,
  Wrench,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import StoreBadge from "./StoreBadge";
import ControllerCompatibility from "./ControllerCompatibility";
import EssentialImprovements from "./EssentialImprovements";
import CollapsibleSection from "./CollapsibleSection";
import CompactFeatureGrid from "./CompactFeatureGrid";
import ModDashboard from "./ModDashboard";
import QuickStatusBar from "./QuickStatusBar";
import SaveBackupPanel from "./SaveBackupPanel";
import GamePersonalization from "./GamePersonalization";
import LocalInstallationPanel from "./LocalInstallationPanel";
import StorageInstallPanel from "./StorageInstallPanel";
import ScreenshotBrowserPanel from "./ScreenshotBrowserPanel";
import TechnicalDetailsPanel from "./TechnicalDetailsPanel";
import ExternalToolsPanel from "./ExternalToolsPanel";
import GameHealthPanel from "./GameHealthPanel";
import HardwareCapabilityPanel from "./HardwareCapabilityPanel";
import KnownIssuesPanel from "./KnownIssuesPanel";
import LibraryDashboard from "./LibraryDashboard";
import LibraryEntryEditor from "./LibraryEntryEditor";

import {
  error as logError,
} from "../services/logging";

import {
  openGamePath,
} from "../services/pathActions";

import {
  launchGame,
} from "../services/gameLaunch";

import {
  storeGameInsight,
} from "../services/libraryInsights";


function getGameCoverArt(game) {
  if (!game) {
    return null;
  }

  const explicitCover =
    game.coverImageUrl
    ?? game.coverArtUrl
    ?? game.coverUrl
    ?? game.imageUrl
    ?? null;

  if (explicitCover) {
    return explicitCover;
  }

  const store =
    String(game.store ?? "")
      .trim()
      .toLowerCase();

  const launcherId =
    String(game.launcherId ?? "")
      .trim();

  if (
    store === "steam"
    && launcherId
  ) {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${launcherId}/library_600x900.jpg`;
  }

  return null;
}


function InfoRow({
  icon: Icon,
  label,
  value,
  actionLabel = null,
  onAction = null,
  actionDisabled = false,
}) {
  return (
    <div
      className="
        flex
        items-start
        gap-3
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
        p-3.5
      "
    >
      <div
        className="
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-lg
          bg-cyan-500/10
          text-cyan-300
        "
      >
        <Icon
          className="h-4 w-4"
        />
      </div>

      <div
        className="
          min-w-0
          flex-1
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            gap-3
          "
        >
          <div
            className="
              text-[11px]
              font-semibold
              uppercase
              tracking-wide
              text-white/35
            "
          >
            {label}
          </div>

          {actionLabel ? (
            <button
              type="button"
              onClick={
                onAction
              }
              disabled={
                actionDisabled
              }
              className="
                inline-flex
                shrink-0
                items-center
                gap-1.5
                rounded-md
                border
                border-white/10
                bg-white/[0.035]
                px-2
                py-1
                text-[11px]
                font-medium
                text-white/55
                transition
                hover:bg-white/[0.07]
                hover:text-white/75
                disabled:cursor-not-allowed
                disabled:opacity-30
              "
            >
              <FolderOpen
                className="h-3 w-3"
              />

              {actionLabel}
            </button>
          ) : null}
        </div>

        <div
          className="
            mt-1.5
            break-words
            text-sm
            leading-relaxed
            text-white/80
          "
        >
          {value || "Unknown"}
        </div>
      </div>
    </div>
  );
}


function WsgfInfo({
  features,
}) {
  const awards =
    features?.wsgfAwards;

  if (
    !features?.wsgfLink &&
    !awards?.widescreen &&
    !awards?.multimonitor &&
    !awards?.ultrawide &&
    !awards?.fourK
  ) {
    return null;
  }


  async function openWsgf() {
    if (!features?.wsgfLink) {
      return;
    }

    try {
      await openUrl(
        features.wsgfLink
      );
    } catch (error) {
      logError(
        "[WSGF] Failed to open:",
        error
      );
    }
  }


  return (
    <div
      className="
        mt-4
        flex
        flex-col
        gap-3
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
        p-4
        lg:flex-row
        lg:items-center
        lg:justify-between
      "
    >
      <div>
        <div
          className="
            text-sm
            font-semibold
            text-white/75
          "
        >
          Widescreen Gaming Forum
        </div>

        <div
          className="
            mt-2
            flex
            flex-wrap
            gap-x-4
            gap-y-1
            text-xs
            text-white/40
          "
        >
          {awards?.widescreen ? (
            <span>
              Widescreen:{" "}
              {awards.widescreen}
            </span>
          ) : null}

          {awards?.multimonitor ? (
            <span>
              Multi-monitor:{" "}
              {awards.multimonitor}
            </span>
          ) : null}

          {awards?.ultrawide ? (
            <span>
              Ultrawide:{" "}
              {awards.ultrawide}
            </span>
          ) : null}

          {awards?.fourK ? (
            <span>
              4K:{" "}
              {awards.fourK}
            </span>
          ) : null}
        </div>
      </div>

      {features?.wsgfLink ? (
        <button
          type="button"
          onClick={
            openWsgf
          }
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            border-white/10
            bg-white/[0.035]
            px-3
            py-2
            text-xs
            font-medium
            text-white/65
            transition
            hover:bg-white/[0.07]
          "
        >
          View WSGF

          <ExternalLink
            className="h-3.5 w-3.5"
          />
        </button>
      ) : null}
    </div>
  );
}


function PcgwMatch({
  game,
}) {
  async function handleOpenPcgw() {
    if (!game?.pcgwPageUrl) {
      return;
    }

    try {
      await openUrl(
        game.pcgwPageUrl
      );
    } catch (error) {
      logError(
        "[PCGW] Failed to open page:",
        error
      );
    }
  }


  if (game.pcgwLoading) {
    return (
      <div
        className="
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
          text-sm
          text-white/40
        "
      >
        Loading PCGamingWiki information...
      </div>
    );
  }


  if (game.pcgwError) {
    return (
      <div
        className="
          rounded-xl
          border
          border-red-500/20
          bg-red-500/[0.06]
          p-4
        "
      >
        <div
          className="
            text-sm
            font-semibold
            text-red-300
          "
        >
          PCGamingWiki lookup failed
        </div>

        <div
          className="
            mt-2
            text-xs
            text-red-200/50
          "
        >
          {game.pcgwError}
        </div>
      </div>
    );
  }


  if (!game.pcgwPageName) {
    return (
      <div
        className="
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
          text-sm
          text-white/35
        "
      >
        No PCGamingWiki match found.
      </div>
    );
  }


  return (
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
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <BadgeCheck
          className="
            h-5
            w-5
            text-emerald-400
          "
        />

        <div>
          <div
            className="
              text-sm
              font-semibold
              text-white/75
            "
          >
            PCGamingWiki Match
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/40
            "
          >
            {game.pcgwPageName}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={
          handleOpenPcgw
        }
        className="
          inline-flex
          items-center
          justify-center
          gap-2
          rounded-lg
          border
          border-white/10
          bg-white/[0.035]
          px-3
          py-2
          text-xs
          font-medium
          text-white/65
          transition
          hover:bg-white/[0.07]
        "
      >
        View on PCGamingWiki

        <ExternalLink
          className="h-3.5 w-3.5"
        />
      </button>
    </div>
  );
}


function controllerSummary(
  game
) {
  const controllers =
    game?.controllerCompatibility
    ?? {};

  const values = [
    controllers?.xbox
      ?.supported,
    controllers?.playstation
      ?.supported,
    controllers?.nintendo
      ?.supported,
  ];

  const supported =
    values.filter(
      (value) =>
        value === true
    ).length;

  if (supported > 0) {
    return `${supported} controller families supported`;
  }

  return "Controller details";
}


function modSummary(
  game
) {
  const items = [
    game?.renodx?.renodx
      ?.available,
    game?.renodx?.luma
      ?.available,
    game?.vortex
      ?.supported,
    game?.fluffy
      ?.supported,
  ];

  const count =
    items.filter(Boolean)
      .length;

  return count > 0
    ? `${count} known enhancement${count === 1 ? "" : "s"}`
    : "Local & provider mod status";
}


export default function GameDetails({
  game,
  libraryGames = [],
  onAnalyzeRemaining,
  onRefreshStale,
  libraryAnalysis,
  onCheckForUpdates,
  updateCheckStatus,
  onSelectGame,
}) {
  const [
    pathError,
    setPathError,
  ] =
    useState(null);

  const [
    launchingGame,
    setLaunchingGame,
  ] =
    useState(false);

  const [
    launchError,
    setLaunchError,
  ] =
    useState(null);

  const [
    coverImageFailed,
    setCoverImageFailed,
  ] =
    useState(false);

  const coverArtUrl =
    getGameCoverArt(
      game
    );


  useEffect(
    () => {
      setCoverImageFailed(
        false
      );
    },
    [
      coverArtUrl,
    ]
  );


  useEffect(
    () => {
      if (game) {
        storeGameInsight(
          game
        );
      }
    },
    [
      game?.id,
      game?.pcgwLoaded,
      game?.renodxLoaded,
      game?.vortexLoaded,
      game?.fluffyLoaded,
      game?.features,
      game?.renodx,
      game?.vortex,
      game?.fluffy,
    ]
  );


  if (!game) {
    return (
      <LibraryDashboard
        games={
          libraryGames
        }
        onAnalyzeRemaining={
          onAnalyzeRemaining
        }
        onRefreshStale={
          onRefreshStale
        }
        libraryAnalysis={
          libraryAnalysis
        }
        onCheckForUpdates={
          onCheckForUpdates
        }
        updateCheckStatus={
          updateCheckStatus
        }
        onSelectGame={
          onSelectGame
        }
      />
    );
  }


  const features =
    game.features
    ?? {};


  async function handleLaunchGame() {
    setLaunchingGame(
      true
    );

    setLaunchError(
      null
    );

    try {
      await launchGame(
        game
      );
    } catch (error) {
      logError(
        "[Launch] Failed:",
        error
      );

      setLaunchError(
        String(
          error
        )
      );
    } finally {
      setLaunchingGame(
        false
      );
    }
  }


  async function handleOpenPath(
    path
  ) {
    setPathError(
      null
    );

    try {
      await openGamePath(
        path,
        game.installPath
      );
    } catch (error) {
      logError(
        "[Paths] Failed to open:",
        error
      );

      setPathError(
        String(error)
      );
    }
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
          w-full
          max-w-[1500px]
          px-6
          py-7
          xl:px-8
        "
      >
        {/* ====================================================
            HEADER + AT-A-GLANCE STATUS
        ==================================================== */}

        <section
          className="
            mb-7
          "
        >
          <div
            className="
              flex
              flex-col
              gap-6
              sm:flex-row
              sm:items-start
              sm:justify-between
            "
          >
            <div
              className="
                min-w-0
                flex-1
              "
            >
              <StoreBadge
                store={
                  game.store
                }
              />

              <h1
                className="
                  mt-3
                  break-words
                  text-3xl
                  font-bold
                  tracking-tight
                  text-white
                  xl:text-4xl
                "
              >
                {game.name}
              </h1>

              <div
                className="
                  mt-3
                  flex
                  flex-wrap
                  gap-5
                  text-sm
                  text-white/40
                "
              >
                {game.developer ? (
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <UserRoundCog
                      className="h-4 w-4"
                    />

                    {game.developer}
                  </div>
                ) : null}

                {game.releaseDate ? (
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <CalendarDays
                      className="h-4 w-4"
                    />

                    {game.releaseDate}
                  </div>
                ) : null}
              </div>

              <div
                className="
                  mt-5
                  flex
                  flex-wrap
                  items-center
                  gap-3
                "
              >
                <button
                  type="button"
                  onClick={
                    handleLaunchGame
                  }
                  disabled={
                    launchingGame
                  }
                  className="
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-cyan-400/30
                    bg-cyan-500/15
                    px-5
                    py-2.5
                    text-sm
                    font-semibold
                    text-cyan-100
                    shadow-lg
                    shadow-cyan-950/20
                    transition
                    hover:border-cyan-300/40
                    hover:bg-cyan-500/20
                    disabled:cursor-not-allowed
                    disabled:opacity-45
                  "
                >
                  {launchingGame ? (
                    <LoaderCircle
                      className="
                        h-4
                        w-4
                        animate-spin
                      "
                    />
                  ) : (
                    <Play
                      className="
                        h-4
                        w-4
                        fill-current
                      "
                    />
                  )}

                  {launchingGame
                    ? "Launching..."
                    : "Play Game"
                  }
                </button>

                <div
                  className="
                    text-xs
                    text-white/30
                  "
                >
                  Launch through {game.store}
                </div>
              </div>

              {launchError ? (
                <div
                  className="
                    mt-3
                    max-w-2xl
                    rounded-xl
                    border
                    border-amber-500/20
                    bg-amber-500/[0.06]
                    px-4
                    py-3
                    text-xs
                    leading-relaxed
                    text-amber-200/75
                  "
                >
                  {launchError}
                </div>
              ) : null}

              <QuickStatusBar
                game={
                  game
                }
              />

              <GamePersonalization
                game={
                  game
                }
              />
            </div>


            {coverArtUrl && !coverImageFailed ? (
              <div
                data-pcgw-cover
                className="
                  shrink-0
                  self-start
                "
              >
                <div
                  className="
                    overflow-hidden
                    rounded-xl
                    border
                    border-white/10
                    bg-white/[0.025]
                    shadow-2xl
                    shadow-black/25
                  "
                >
                  <img
                    src={
                      coverArtUrl
                    }
                    alt={
                      `${game.name} cover`
                    }
                    className="
                      h-[210px]
                      w-[145px]
                      object-cover
                      md:h-[240px]
                      md:w-[165px]
                      xl:h-[270px]
                      xl:w-[185px]
                    "
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={
                      () => {
                        logError(
                          "[PCGW] Cover image failed to load:",
                          coverArtUrl
                        );

                        setCoverImageFailed(
                          true
                        );
                      }
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>


        {/* ====================================================
            PROGRESSIVE-DISCLOSURE SECTIONS
        ==================================================== */}

        <CollapsibleSection
          id="overview"
          title="Quick Overview"
          description="Core game information."
          icon={Info}
          defaultOpen
          summary={
            game.developer
              ? game.developer
              : game.store
          }
        >
          <div
            className="
              grid
              grid-cols-1
              gap-3
              md:grid-cols-2
              xl:grid-cols-4
            "
          >
            <InfoRow
              icon={UserRoundCog}
              label="Developer"
              value={
                game.developer
              }
            />

            <InfoRow
              icon={Package}
              label="Publisher"
              value={
                game.publisher
              }
            />

            <InfoRow
              icon={CalendarDays}
              label="Release Date"
              value={
                game.releaseDate
              }
            />

            <InfoRow
              icon={Store}
              label="Store"
              value={
                game.store
              }
            />
          </div>
        </CollapsibleSection>


        <CollapsibleSection
          id="pc-features"
          title="PC Features"
          description="Graphics, display, frame-rate, and video features from PCGamingWiki. Click any tile with notes to expand it."
          icon={Monitor}
          defaultOpen
          summary="17 feature checks"
        >
          <CompactFeatureGrid
            features={
              features
            }
          />

          <WsgfInfo
            features={
              features
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="mods"
          title="Mods & Enhancements"
          description="Consolidated enhancement support, mod managers, and local mod evidence."
          icon={Puzzle}
          defaultOpen
          summary={
            modSummary(
              game
            )
          }
        >
          <ModDashboard
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="external-tools"
          title="External Tools"
          description="Detected game tools, mod managers, local integrations, and quick launch actions."
          icon={Wrench}
          defaultOpen={true}
          summary="Game tools & launch hub"
        >
          <ExternalToolsPanel
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="controllers"
          title="Controller Support"
          description="Xbox, PlayStation, DualSense, Nintendo, and hot-plug information."
          icon={Gamepad2}
          defaultOpen={false}
          summary={
            controllerSummary(
              game
            )
          }
        >
          <ControllerCompatibility
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="essential-improvements"
          title="Essential Improvements"
          description="Recommended fixes and improvements from PCGamingWiki."
          icon={Wrench}
          defaultOpen={false}
          summary={
            game.essentialImprovementsHtml
              ? "Recommendations available"
              : "No recommendations listed"
          }
        >
          <EssentialImprovements
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="known-issues"
          title="Known Issues & Fixes"
          description="Unresolved and fixed issues from the matched PCGamingWiki page."
          icon={TriangleAlert}
          defaultOpen={false}
          summary="PCGamingWiki issue tracking"
        >
          <KnownIssuesPanel
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="installation-health"
          title="Installation Health"
          description="Actionable setup-readiness checks with direct fixes where GameAtlas can safely provide them."
          icon={HeartPulse}
          defaultOpen={true}
          summary="Readiness score & checks"
        >
          <GameHealthPanel
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="hardware-capabilities"
          title="Hardware Compatibility"
          description="Compare game capabilities with conservatively detected local hardware families."
          icon={MonitorCog}
          defaultOpen={false}
          summary="CPU, GPU, RAM & capability checks"
        >
          <HardwareCapabilityPanel
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="local-installation"
          title="Local Installation"
          description="Inspect the files actually installed on this computer."
          icon={HardDrive}
          defaultOpen={true}
          summary="Executable, graphics DLLs, ReShade & mod-manager evidence"
        >
          <LocalInstallationPanel
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="storage-installation"
          title="Storage & Installation"
          description="Install size, drive capacity, executable size, save/config data, and largest local files."
          icon={HardDrive}
          defaultOpen={true}
          summary="Disk usage & local storage"
        >
          <StorageInstallPanel
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="screenshots"
          title="Screenshots"
          description="Detected Steam and common local screenshot folders."
          icon={Monitor}
          defaultOpen={false}
          summary="Count, newest screenshot & folder"
        >
          <ScreenshotBrowserPanel
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="save-backups"
          title="Save Backups"
          description="Create and restore timestamped backups of this game's save data."
          icon={HardDrive}
          defaultOpen={false}
          summary="Backup & restore"
        >
          <SaveBackupPanel
            game={
              game
            }
          />
        </CollapsibleSection>


        <CollapsibleSection
          id="technical"
          title="Technical Information"
          description="Engine, graphics API, installation, configuration, and save locations."
          icon={Settings2}
          defaultOpen={false}
          summary={
            game.technical?.engine
            ?? game.technical?.api
            ?? "Technical details"
          }
        >
          <TechnicalDetailsPanel
            game={
              game
            }
          />

          <div
            className="
              mb-4
            "
          >
            <LibraryEntryEditor
              game={
                game
              }
            />
          </div>

          {pathError ? (
            <div
              className="
                mb-3
                rounded-xl
                border
                border-amber-500/20
                bg-amber-500/[0.06]
                px-4
                py-3
                text-xs
                leading-relaxed
                text-amber-200/75
              "
            >
              {pathError}
            </div>
          ) : null}

          <div
            className="
              grid
              grid-cols-1
              gap-3
              xl:grid-cols-2
            "
          >
            <InfoRow
              icon={Cpu}
              label="Engine"
              value={
                game.technical?.engine
              }
            />

            <InfoRow
              icon={Code2}
              label="Graphics API"
              value={
                game.technical?.api
              }
            />

            <InfoRow
              icon={FolderOpen}
              label="Install Location"
              value={
                game.installPath
              }
              actionLabel="Open"
              actionDisabled={
                !game.installPath
              }
              onAction={
                () =>
                  handleOpenPath(
                    game.installPath
                  )
              }
            />

            <InfoRow
              icon={FileCode2}
              label="Configuration Location"
              value={
                game.technical
                  ?.configLocation
              }
              actionLabel="Open"
              actionDisabled={
                !game.technical
                  ?.configLocation
              }
              onAction={
                () =>
                  handleOpenPath(
                    game.technical
                      ?.configLocation
                  )
              }
            />

            <InfoRow
              icon={FolderOpen}
              label="Save Location"
              value={
                game.technical
                  ?.saveLocation
              }
              actionLabel="Open"
              actionDisabled={
                !game.technical
                  ?.saveLocation
              }
              onAction={
                () =>
                  handleOpenPath(
                    game.technical
                      ?.saveLocation
                  )
              }
            />

            <InfoRow
              icon={Radio}
              label="Launcher ID"
              value={
                game.launcherId
              }
            />
          </div>
        </CollapsibleSection>


        <CollapsibleSection
          id="pcgamingwiki"
          title="PCGamingWiki"
          description="Source match and direct link to the full game article."
          icon={BadgeCheck}
          defaultOpen={false}
          summary={
            game.pcgwPageName
              ? "Matched"
              : "No match"
          }
          className="mb-10"
        >
          <PcgwMatch
            game={
              game
            }
          />
        </CollapsibleSection>
      </div>
    </main>
  );
}
