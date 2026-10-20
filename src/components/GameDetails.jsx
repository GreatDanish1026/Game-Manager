import {
  BadgeCheck,
  CalendarDays,
  ExternalLink,
  FolderOpen,
  Archive,
  Gamepad2,
  HardDrive,
  MonitorCog,
  Info,
  Monitor,
  Package,
  Play,
  Puzzle,
  Settings2,
  Store,
  TriangleAlert,
  UserRoundCog,
  Wrench,
} from "lucide-react";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import ControllerCompatibility from "./ControllerCompatibility";
import EssentialImprovements from "./EssentialImprovements";
import CollapsibleSection from "./CollapsibleSection";
import CompactFeatureGrid from "./CompactFeatureGrid";
import ModDashboard from "./ModDashboard";
import ModConflictInspectorPanel from "./ModConflictInspectorPanel";
import LinuxModDeploymentPanel from "./LinuxModDeploymentPanel";
import GameHeader from "./GameHeader";
import LaunchProfilesPanel from "./LaunchProfilesPanel";
import PlayStatusNotesPanel from "./PlayStatusNotesPanel";
import RecentActivityPanel from "./RecentActivityPanel";
import ChangeHistoryPanel from "./ChangeHistoryPanel";
import GameFileUtilitiesPanel from "./GameFileUtilitiesPanel";
import SaveBackupPanel from "./SaveBackupPanel";
import SaveBrowserPanel from "./SaveBrowserPanel";
import GamePersonalization from "./GamePersonalization";
import PersonalRatingPanel from "./PersonalRatingPanel";
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

import ModChangeTimeline from "./ModChangeTimeline";
import GameVersionPanel from "./GameVersionPanel";
import CompatibilitySetupPanel from "./CompatibilitySetupPanel";
import {
  error as logError,
} from "../services/logging";


import {
  storeGameInsight,
} from "../services/libraryInsights";
import ProtonToolboxPanel from "./ProtonToolboxPanel";
import LinuxPerformancePanel from "./LinuxPerformancePanel";
import LinuxReadinessOverview from "./LinuxReadinessOverview";
import WindowsPerformanceDiagnosticsPanel from "./WindowsPerformanceDiagnosticsPanel";
import BackgroundConflictPanel from "./BackgroundConflictPanel";
import CleanLaunchPanel from "./CleanLaunchPanel";
import ShaderCachePanel from "./ShaderCachePanel";
import GraphicsDriverDiagnosticsPanel from "./GraphicsDriverDiagnosticsPanel";
import CrashDetectivePanel from "./CrashDetectivePanel";
import DisplayValidatorPanel from "./DisplayValidatorPanel";
import RuntimeDependencyDoctorPanel from "./RuntimeDependencyDoctorPanel";
import PerformanceCapturePanel from "./PerformanceCapturePanel";
import ConfigurationValidatorPanel from "./ConfigurationValidatorPanel";
import LaunchFailureAnalyzerPanel from "./LaunchFailureAnalyzerPanel";
import TroubleshootingGuide from "./TroubleshootingGuide";


import RenoDxManagerPanel from "./RenoDxManagerPanel";

function runningOnLinux() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /linux/i.test(
    navigator.userAgent
    ?? ""
  );
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


const GAME_TABS = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "setup", label: "Setup & performance", icon: MonitorCog },
  { id: "mods", label: "Mods", icon: Puzzle },
  { id: "files", label: "Files & saves", icon: HardDrive },
  { id: "troubleshoot", label: "Troubleshoot", icon: Wrench },
];


// Section ids predate the tabs and are still used by links across the app.
const SECTION_TABS = {
  overview: "overview",
  "known-issues": "overview",
  "my-game": "overview",
  "compatibility-performance": "setup",
  "launch-profiles": "setup",
  "pc-features": "setup",
  "controller-support": "setup",
  mods: "mods",
  "mod-tools-shortcuts": "mods",
  "files-installation": "files",
  "saves-screenshots": "files",
  "technical-troubleshooting": "troubleshoot",
  "advanced-diagnostics": "troubleshoot",
};


function PageSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}) {
  return (
    <section
      id={`game-section-${id}`}
      aria-labelledby={`game-section-${id}-title`}
      className="mb-10 scroll-mt-20"
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <h2 id={`game-section-${id}-title`} className="text-lg font-semibold text-white/90">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-sm text-white/45">{description}</p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}


const GameTabBar = forwardRef(function GameTabBar({
  activeTab,
  onSelect,
}, ref) {
  function handleKeyDown(event) {
    const index = GAME_TABS.findIndex((tab) => tab.id === activeTab);
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];

    if (!step) return;

    event.preventDefault();
    const next = GAME_TABS[(index + step + GAME_TABS.length) % GAME_TABS.length];
    onSelect(next.id);
    document.getElementById(`game-tab-${next.id}`)?.focus();
  }

  return (
    <div
      ref={ref}
      className="sticky top-0 z-20 -mx-2 mb-6 border-b border-white/[0.07] bg-[#0b0f17]/95 px-2 backdrop-blur-xl"
    >
      <div
        role="tablist"
        aria-label="Game sections"
        onKeyDown={handleKeyDown}
        className="flex gap-1 overflow-x-auto"
      >
        {GAME_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              id={`game-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`game-tabpanel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3.5 xl:px-4 text-sm font-semibold whitespace-nowrap transition focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300 ${
                active
                  ? "border-cyan-300 text-white"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-cyan-300" : ""}`} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
});


// Tabs mount on first visit and then stay mounted (hidden) so panel state
// and in-progress checks survive switching back and forth.
function TabPanel({
  id,
  activeTab,
  visitedTabs,
  children,
}) {
  if (!visitedTabs.has(id)) {
    return null;
  }

  return (
    <div
      id={`game-tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={`game-tab-${id}`}
      hidden={activeTab !== id}
    >
      {children}
    </div>
  );
}


export default function GameDetails({
  game,
  focusTarget = null,
  libraryGames = [],
  hiddenGameIds = [],
  onAnalyzeRemaining,
  onRefreshStale,
  libraryAnalysis,
  onCancelLibraryAnalysis,
  onRescanLibrary,
  libraryScanLoading = false,
  onCheckForUpdates,
  updateCheckStatus,
  onSelectGame,
  networkOnline = true,
}) {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState("overview");

  const [
    visitedTabs,
    setVisitedTabs,
  ] =
    useState(() => new Set(["overview"]));

  const tabBarRef =
    useRef(null);

  function showTab(
    tabId,
    { scrollToTabs = false } = {}
  ) {
    setActiveTab(tabId);
    setVisitedTabs((current) => (current.has(tabId) ? current : new Set([...current, tabId])));

    // Keep the tab bar in view when switching from far down a long tab.
    if (scrollToTabs && tabBarRef.current?.getBoundingClientRect().top <= 1) {
      tabBarRef.current.scrollIntoView({ block: "start" });
    }
  }

  // Older links (troubleshooting guide, health checks, NXM links) open
  // sections by id; switch to the tab that now holds that section.
  useEffect(() => {
    function handleOpenSection(event) {
      const tabId = SECTION_TABS[event?.detail?.id];

      if (tabId) {
        showTab(tabId);
      }
    }

    window.addEventListener("game-manager-open-section", handleOpenSection);
    return () => window.removeEventListener("game-manager-open-section", handleOpenSection);
  }, []);

  useEffect(() => {
    if (!game || focusTarget !== "health") {
      return undefined;
    }

    let scrollTimer;
    let attempts = 0;
    const openTimer = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("game-manager-open-section", {
          detail: { id: "compatibility-performance" },
        })
      );

      const scrollToCheck = () => {
        const target = document.getElementById("game-health-check");

        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (attempts < 10) {
          attempts += 1;
          scrollTimer = window.setTimeout(scrollToCheck, 50);
        }
      };

      scrollTimer = window.setTimeout(scrollToCheck, 50);
    }, 0);

    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(scrollTimer);
    };
  }, [game?.id, focusTarget]);


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
        hiddenGameIds={
          hiddenGameIds
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
        onCancelLibraryAnalysis={
          onCancelLibraryAnalysis
        }
        onRescanLibrary={
          onRescanLibrary
        }
        libraryScanLoading={
          libraryScanLoading
        }
        onSelectGame={
          onSelectGame
        }
        networkOnline={
          networkOnline
        }
      />
    );
  }


  const features =
    game.features
    ?? {};

  const isLinux =
    runningOnLinux();


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
        <GameHeader
          game={game}
          networkOnline={networkOnline}
        />

        <GameTabBar
          ref={tabBarRef}
          activeTab={activeTab}
          onSelect={(tabId) => showTab(tabId, { scrollToTabs: true })}
        />

        <TabPanel id="overview" activeTab={activeTab} visitedTabs={visitedTabs}>
          {isLinux ? (
            <LinuxReadinessOverview
              key={`linux-readiness-${game.id}`}
              game={game}
            />
          ) : null}

          <PageSection
            id="known-issues"
            icon={TriangleAlert}
            title="Known issues & fixes"
            description="Unresolved problems and recommended fixes from PCGamingWiki."
          >
            <div id="game-known-issues" className="scroll-mt-20">
              <KnownIssuesPanel game={game} />
            </div>

            <div className="mt-5">
              <EssentialImprovements game={game} />
            </div>
          </PageSection>

          <PageSection
            id="my-game"
            icon={UserRoundCog}
            title="My game"
            description="Your play status, rating, tags, notes, and recent activity."
          >
            <GamePersonalization game={game} />
            <PersonalRatingPanel game={game} />

            <div className="mt-5">
              <PlayStatusNotesPanel game={game} />
            </div>

            <div className="mt-5">
              <RecentActivityPanel game={game} />
            </div>
          </PageSection>

          <PageSection
            id="overview"
            icon={Info}
            title="About"
            description="Core game information, detected version, and technical details."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoRow icon={UserRoundCog} label="Developer" value={game.developer} />
              <InfoRow icon={Package} label="Publisher" value={game.publisher} />
              <InfoRow icon={CalendarDays} label="Release Date" value={game.releaseDate} />
              <InfoRow icon={Store} label="Store" value={game.store} />
            </div>

            <div className="mt-4">
              <GameVersionPanel game={game} />
            </div>

            <div className="mt-5">
              <TechnicalDetailsPanel game={game} />
            </div>

            <div className="mt-5">
              <PcgwMatch game={game} />
            </div>
          </PageSection>
        </TabPanel>


        <TabPanel id="setup" activeTab={activeTab} visitedTabs={visitedTabs}>
          <PageSection
            id="compatibility-performance"
            icon={MonitorCog}
            title="Compatibility & health"
            description="System fit, verified settings, the game health check, and hardware capability."
          >
            <CompatibilitySetupPanel game={game} />

            <div id="game-health-check" className="mt-5 scroll-mt-20">
              <GameHealthPanel game={game} isWindows={!isLinux} />
            </div>

            <div className="mt-5">
              <HardwareCapabilityPanel game={game} />
            </div>

            {isLinux ? (
              <div className="mt-5">
                <LinuxPerformancePanel game={game} />
              </div>
            ) : null}
          </PageSection>

          <PageSection
            id="launch-profiles"
            icon={Play}
            title="Launch profiles"
            description="Saved launch options. The default profile is what Play uses."
          >
            <div id="game-launch-profiles" className="scroll-mt-20">
              <LaunchProfilesPanel game={game} />
            </div>
          </PageSection>

          <PageSection
            id="pc-features"
            icon={Monitor}
            title="Graphics & PC features"
            description="Graphics, display, frame-rate, widescreen, and controller capabilities from PCGamingWiki."
          >
            <CompactFeatureGrid features={features} />
            <WsgfInfo features={features} />

            <CollapsibleSection
              id="controller-support"
              persistOpen={false}
              title="Controller Support"
              description="Controller families, prompts, connection modes, hotplugging, and DualSense features."
              icon={Gamepad2}
              defaultOpen={false}
              summary={controllerSummary(game)}
              className="mt-5"
            >
              <ControllerCompatibility game={game} />
            </CollapsibleSection>
          </PageSection>
        </TabPanel>


        <TabPanel id="mods" activeTab={activeTab} visitedTabs={visitedTabs}>
          <PageSection
            id="mods"
            icon={Puzzle}
            title="Mods & enhancements"
            description={`${modSummary(game)}. Mod managers, local mod evidence, conflicts, and change history.`}
          >
            <ModDashboard game={game} />

            {isLinux ? (
              <LinuxModDeploymentPanel game={game} isLinux={isLinux} />
            ) : null}

            <ModConflictInspectorPanel game={game} isLinux={isLinux} />
            <RenoDxManagerPanel game={game} />

            <div className="mt-5">
              <ModChangeTimeline game={game} />
            </div>

            <CollapsibleSection
              id="mod-tools-shortcuts"
              persistOpen={false}
              title="Tool launchers & shortcuts"
              description="Launch installed mod managers, open game folders, and inspect additional local tools."
              icon={Wrench}
              defaultOpen={false}
              summary="Apps, folders & tables"
              className="mt-5"
            >
              <ExternalToolsPanel game={game} />
            </CollapsibleSection>
          </PageSection>
        </TabPanel>


        <TabPanel id="files" activeTab={activeTab} visitedTabs={visitedTabs}>
          <PageSection
            id="saves-screenshots"
            icon={Archive}
            title="Saves & screenshots"
            description="Browse live save data, manage backups, and open detected screenshots."
          >
            <SaveBrowserPanel game={game} />

            <div id="game-save-backups" className="mt-5 scroll-mt-20">
              <SaveBackupPanel game={game} />
            </div>

            <div className="mt-5">
              <ScreenshotBrowserPanel game={game} />
            </div>
          </PageSection>

          <PageSection
            id="files-installation"
            icon={HardDrive}
            title="Files & installation"
            description="Local game-binary details, storage usage, file utilities, and installation-change history."
          >
            {/* GAMEATLAS_LOCAL_INSTALLATION_FAST_PATH_PHASE3 */}
            <LocalInstallationPanel game={game} />

            <div className="mt-5">
              <StorageInstallPanel game={game} isLinux={isLinux} />
            </div>

            <div className="mt-5">
              <GameFileUtilitiesPanel game={game} />
            </div>

            <div className="mt-5">
              <LibraryEntryEditor game={game} />
            </div>

            <div className="mt-5">
              <ChangeHistoryPanel game={game} />
            </div>
          </PageSection>
        </TabPanel>


        <TabPanel id="troubleshoot" activeTab={activeTab} visitedTabs={visitedTabs}>
          <PageSection
            id="technical-troubleshooting"
            icon={Settings2}
            title="Troubleshooting guide"
            description="Pick a symptom to jump to the checks most likely to help."
          >
            <TroubleshootingGuide key={game.id} />
          </PageSection>

          <PageSection
            id="advanced-diagnostics"
            icon={Wrench}
            title="Diagnostic tools"
            description="Each tool runs only when you start it."
          >
            <div id="diagnostic-crash-detective" className="scroll-mt-20">
              <CrashDetectivePanel game={game} isLinux={isLinux} />
            </div>

            <div id="diagnostic-launch-failure" className="scroll-mt-20">
              <LaunchFailureAnalyzerPanel game={game} isLinux={isLinux} />
            </div>

            <div id="diagnostic-display" className="scroll-mt-20">
              <DisplayValidatorPanel game={game} />
            </div>

            <div id="diagnostic-runtime-dependencies" className="scroll-mt-20">
              <RuntimeDependencyDoctorPanel game={game} isLinux={isLinux} />
            </div>

            <div id="diagnostic-windows-performance" className="scroll-mt-20">
              <WindowsPerformanceDiagnosticsPanel game={game} isLinux={isLinux} />
            </div>

            <div id="diagnostic-performance-capture" className="scroll-mt-20">
              <PerformanceCapturePanel game={game} />
            </div>

            <div id="diagnostic-configuration-validator" className="scroll-mt-20">
              <ConfigurationValidatorPanel game={game} isLinux={isLinux} />
            </div>

            <div id="diagnostic-background-apps" className="scroll-mt-20">
              <BackgroundConflictPanel isLinux={isLinux} />
            </div>

            <div id="diagnostic-clean-launch" className="scroll-mt-20">
              <CleanLaunchPanel game={game} />
            </div>

            <ShaderCachePanel game={game} />

            <div id="diagnostic-graphics-drivers" className="scroll-mt-20">
              <GraphicsDriverDiagnosticsPanel />
            </div>

            {isLinux ? (
              <div className="mt-5">
                <ProtonToolboxPanel game={game} />
              </div>
            ) : null}
          </PageSection>
        </TabPanel>
      </div>
    </main>
  );
}
