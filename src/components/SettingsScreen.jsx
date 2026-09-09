import {
  Archive,
  BadgeInfo,
  Bookmark,
  Database,
  ExternalLink,
  Gauge,
  Library,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Sparkles,
  Stethoscope,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getName,
  getVersion,
} from "@tauri-apps/api/app";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import {
  error as logError,
} from "../services/logging";

import {
  clearAnalysisCache,
  clearExternalServiceStatusCache,
  clearInstallationHealthCache,
  clearLibraryFilterCache,
  clearSafeCaches,
  clearSavedViews,
  getCacheSummary,
  getSavedViewCount,
  getSettings,
  resetSettings,
  updateSettings,
} from "../services/settings";

import {
  getBackupStorageSummary,
} from "../services/saveBackups";

import DiagnosticsPanel from "./DiagnosticsPanel";


const REPOSITORY_URL =
  "https://github.com/GreatDanish1026/Game-Manager";


const SECTIONS = [
  {
    id:
      "general",

    label:
      "General",

    icon:
      Settings2,
  },
  {
    id:
      "library",

    label:
      "Library",

    icon:
      Library,
  },
  {
    id:
      "analysis",

    label:
      "Analysis",

    icon:
      Gauge,
  },
  {
    id:
      "backups",

    label:
      "Backups",

    icon:
      Archive,
  },
  {
    id:
      "updates",

    label:
      "Updates",

    icon:
      RefreshCcw,
  },
  {
    id:
      "appearance",

    label:
      "Appearance",

    icon:
      Sparkles,
  },
  {
    id:
      "cache",

    label:
      "Cache Controls",

    icon:
      Database,
  },
  {
    id:
      "diagnostics",

    label:
      "Diagnostics",

    icon:
      Stethoscope,
  },
  {
    id:
      "about",

    label:
      "About",

    icon:
      BadgeInfo,
  },
];


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
    && index <
      units.length - 1
  ) {
    next /=
      1024;

    index +=
      1;
  }

  return `${next.toFixed(
    1
  )} ${units[index]}`;
}


function SettingRow({
  title,
  description,
  children,
}) {
  return (
    <div
      className="
        flex
        flex-col
        gap-3
        border-b
        border-white/[0.06]
        py-5
        last:border-b-0
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <div
        className="
          min-w-0
          pr-4
        "
      >
        <div
          className="
            text-sm
            font-semibold
            text-white/80
          "
        >
          {title}
        </div>

        <div
          className="
            mt-1
            max-w-2xl
            text-xs
            leading-relaxed
            text-white/35
          "
        >
          {description}
        </div>
      </div>

      <div
        className="
          shrink-0
        "
      >
        {children}
      </div>
    </div>
  );
}


function Toggle({
  checked,
  onChange,
}) {
  return (
    <button
      type="button"
      onClick={
        () =>
          onChange(
            !checked
          )
      }
      className={`
        relative
        h-7
        w-12
        rounded-full
        border
        transition
        ${
          checked
            ? "border-cyan-400/35 bg-cyan-500/20"
            : "border-white/10 bg-white/[0.035]"
        }
      `}
      aria-pressed={
        checked
      }
    >
      <span
        className={`
          absolute
          top-1
          h-5
          w-5
          rounded-full
          transition
          ${
            checked
              ? "left-6 bg-cyan-300"
              : "left-1 bg-white/35"
          }
        `}
      />
    </button>
  );
}


function Select({
  value,
  onChange,
  children,
}) {
  return (
    <select
      value={
        value
      }
      onChange={
        (event) =>
          onChange(
            event.target.value
          )
      }
      className="
        min-w-[180px]
        rounded-lg
        border
        border-white/[0.08]
        bg-[#111823]
        px-3
        py-2
        text-xs
        text-white/70
        outline-none
        focus:border-cyan-500/35
      "
    >
      {children}
    </select>
  );
}


function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}) {
  return (
    <section
      className="
        rounded-2xl
        border
        border-white/[0.08]
        bg-white/[0.018]
        p-5
      "
    >
      <div
        className="
          flex
          items-start
          gap-3
          border-b
          border-white/[0.06]
          pb-4
        "
      >
        <div
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-cyan-500/10
            text-cyan-300
          "
        >
          <Icon
            className="h-5 w-5"
          />
        </div>

        <div>
          <h2
            className="
              text-base
              font-semibold
              text-white/85
            "
          >
            {title}
          </h2>

          <p
            className="
              mt-1
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            {description}
          </p>
        </div>
      </div>

      <div>
        {children}
      </div>
    </section>
  );
}


export default function SettingsScreen({
  onCheckForUpdates,
  updateCheckStatus,
  games = [],
  networkOnline = true,
}) {
  const [
    activeSection,
    setActiveSection,
  ] =
    useState(
      "general"
    );

  const [
    settings,
    setSettings,
  ] =
    useState(
      () =>
        getSettings()
    );

  const [
    cacheSummary,
    setCacheSummary,
  ] =
    useState(
      () =>
        getCacheSummary()
    );

  const [
    backupSummary,
    setBackupSummary,
  ] =
    useState(null);

  const [
    backupSummaryLoading,
    setBackupSummaryLoading,
  ] =
    useState(false);

  const [
    appName,
    setAppName,
  ] =
    useState(
      "GameAtlas"
    );

  const [
    version,
    setVersion,
  ] =
    useState(null);

  const [
    appInfoLoading,
    setAppInfoLoading,
  ] =
    useState(true);

  const [
    cacheMessage,
    setCacheMessage,
  ] =
    useState(null);


  const [
    settingsMessage,
    setSettingsMessage,
  ] =
    useState(null);

  const [
    savedViewCount,
    setSavedViewCount,
  ] =
    useState(
      () =>
        getSavedViewCount()
    );


  useEffect(
    () => {
      let active =
        true;

      Promise.allSettled([
        getName(),
        getVersion(),
      ])
        .then(
          (results) => {
            if (!active) {
              return;
            }

            if (
              results[0].status ===
              "fulfilled"
            ) {
              setAppName(
                results[0].value
                || "GameAtlas"
              );
            }

            if (
              results[1].status ===
              "fulfilled"
            ) {
              setVersion(
                results[1].value
                || null
              );
            }
          }
        )
        .finally(
          () => {
            if (active) {
              setAppInfoLoading(
                false
              );
            }
          }
        );

      return () => {
        active =
          false;
      };
    },
    []
  );


  useEffect(
    () => {
      if (
        activeSection ===
        "backups"
      ) {
        refreshBackupSummary();
      }
    },
    [
      activeSection,
      settings.backupRetentionCount,
      settings.backupBeforeLaunch,
    ]
  );


  async function refreshBackupSummary() {
    setBackupSummaryLoading(
      true
    );

    try {
      const result =
        await getBackupStorageSummary();

      setBackupSummary(
        result
      );
    } catch (error) {
      logError(
        "[Settings] Backup storage summary failed:",
        error
      );

      setBackupSummary(
        null
      );
    } finally {
      setBackupSummaryLoading(
        false
      );
    }
  }


  function showSettingsMessage(
    message
  ) {
    setSettingsMessage(
      message
    );

    window.setTimeout(
      () =>
        setSettingsMessage(
          null
        ),
      2400
    );
  }


  function changeSetting(
    key,
    value
  ) {
    const next =
      updateSettings({
        [key]:
          value,
      });

    setSettings(
      next
    );

    showSettingsMessage(
      "Setting saved."
    );
  }


  function refreshCacheSummary(
    message
  ) {
    setCacheSummary(
      getCacheSummary()
    );

    setCacheMessage(
      message
    );

    window.setTimeout(
      () =>
        setCacheMessage(
          null
        ),
      2500
    );
  }


  function resetAllSettings() {
    const confirmed =
      window.confirm(
        "Restore all GameAtlas settings to their defaults? Favorites, tags, hidden games, Saved Views, backups, and analysis data will not be deleted."
      );

    if (!confirmed) {
      return;
    }

    const next =
      resetSettings();

    setSettings(
      next
    );

    showSettingsMessage(
      "Settings restored to defaults."
    );
  }


  function removeSavedViews() {
    if (
      savedViewCount <= 0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete all ${savedViewCount} Saved View${savedViewCount === 1 ? "" : "s"}? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    clearSavedViews();

    setSavedViewCount(
      0
    );

    showSettingsMessage(
      "Saved Views deleted."
    );
  }


  const sectionTitle =
    useMemo(
      () =>
        SECTIONS.find(
          (section) =>
            section.id ===
            activeSection
        )?.label
        ?? "Settings",
      [
        activeSection,
      ]
    );


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
        <div
          className="
            flex
            flex-col
            gap-6
            xl:flex-row
          "
        >
          <aside
            className="
              w-full
              shrink-0
              xl:w-56
            "
          >
            <div
              className="
                sticky
                top-0
                rounded-2xl
                border
                border-white/[0.08]
                bg-white/[0.018]
                p-3
              "
            >
              <div
                className="
                  px-2
                  pb-3
                  pt-1
                "
              >
                <div
                  className="
                    text-lg
                    font-semibold
                    text-white
                  "
                >
                  Settings
                </div>

                <div
                  className="
                    mt-1
                    text-xs
                    text-white/30
                  "
                >
                  GameAtlas preferences
                </div>
              </div>

              <div
                className="
                  grid
                  grid-cols-1
                  gap-1
                  sm:grid-cols-2
                  lg:grid-cols-4
                  xl:grid-cols-1
                "
              >
                {SECTIONS.map(
                  (section) => {
                    const Icon =
                      section.icon;

                    const selected =
                      activeSection ===
                      section.id;

                    return (
                      <button
                        key={
                          section.id
                        }
                        type="button"
                        onClick={
                          () =>
                            setActiveSection(
                              section.id
                            )
                        }
                        className={`
                          flex
                          items-center
                          gap-2
                          rounded-lg
                          px-3
                          py-2.5
                          text-left
                          text-xs
                          font-medium
                          transition
                          ${
                            selected
                              ? "bg-cyan-500/12 text-cyan-200"
                              : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                          }
                        `}
                      >
                        <Icon
                          className="h-4 w-4"
                        />

                        {section.label}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </aside>


          <div
            className="
              min-w-0
              flex-1
            "
          >
            <div
              className="
                mb-5
                flex
                items-end
                justify-between
                gap-4
              "
            >
              <div>
                <h1
                  className="
                    text-3xl
                    font-bold
                    tracking-tight
                    text-white
                  "
                >
                  {sectionTitle}
                </h1>

                <p
                  className="
                    mt-2
                    text-sm
                    text-white/35
                  "
                >
                  Changes are saved automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  resetAllSettings
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
                  text-white/45
                  transition
                  hover:bg-white/[0.06]
                  hover:text-white/75
                "
              >
                <RotateCcw
                  className="h-3.5 w-3.5"
                />

                Reset Settings
              </button>
            </div>


            {settingsMessage ? (
              <div
                className="
                  mb-4
                  rounded-xl
                  border
                  border-emerald-500/15
                  bg-emerald-500/[0.04]
                  px-4
                  py-3
                  text-xs
                  text-emerald-200/65
                "
              >
                {settingsMessage}
              </div>
            ) : null}


            {activeSection ===
            "general" ? (
              <SectionCard
                title="General"
                description="Core application behavior."
                icon={Settings2}
              >
                <SettingRow
                  title="Startup destination"
                  description="Choose which screen GameAtlas opens to after the library scan begins."
                >
                  <Select
                    value={
                      settings.startupView
                    }
                    onChange={
                      (value) =>
                        changeSetting(
                          "startupView",
                          value
                        )
                    }
                  >
                    <option
                      value="library"
                    >
                      Library Overview
                    </option>

                    <option
                      value="settings"
                    >
                      Settings
                    </option>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Reset settings"
                  description="Restore GameAtlas settings to their current defaults. Favorites, tags, hidden games, Saved Views, backups, and analysis data are not removed."
                >
                  <button
                    type="button"
                    onClick={
                      resetAllSettings
                    }
                    className="
                      rounded-lg
                      border
                      border-white/[0.08]
                      bg-white/[0.025]
                      px-3
                      py-2
                      text-xs
                      text-white/55
                      hover:bg-white/[0.06]
                    "
                  >
                    Restore Defaults
                  </button>
                </SettingRow>
              </SectionCard>
            ) : null}


            {activeSection ===
            "library" ? (
              <SectionCard
                title="Library"
                description="Preferences for the installed-games library."
                icon={Library}
              >
                <SettingRow
                  title="Show hidden games on startup"
                  description="Open the sidebar in the Hidden Games view when GameAtlas starts."
                >
                  <Toggle
                    checked={
                      settings
                        .showHiddenOnStartup
                    }
                    onChange={
                      (value) =>
                        changeSetting(
                          "showHiddenOnStartup",
                          value
                        )
                    }
                  />
                </SettingRow>

                <SettingRow
                  title="Library scanning"
                  description="Installed Steam, Epic, GOG, and Ubisoft games are scanned when GameAtlas starts. A manual Rescan button remains available in the sidebar."
                >
                  <span
                    className="
                      rounded-full
                      bg-emerald-500/10
                      px-3
                      py-1.5
                      text-xs
                      font-medium
                      text-emerald-300/70
                    "
                  >
                    Enabled
                  </span>
                </SettingRow>

                <SettingRow
                  title="Saved Views"
                  description={
                    savedViewCount > 0
                      ? `${savedViewCount} Saved View${savedViewCount === 1 ? "" : "s"} stored. Views can be created and updated from Library Filters.`
                      : "No Saved Views are currently stored. Create them from Library Filters."
                  }
                >
                  <button
                    type="button"
                    onClick={
                      removeSavedViews
                    }
                    disabled={
                      savedViewCount <= 0
                    }
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      border
                      border-red-500/15
                      bg-red-500/[0.035]
                      px-3
                      py-2
                      text-xs
                      text-red-200/55
                      transition
                      hover:bg-red-500/[0.08]
                      hover:text-red-200/80
                      disabled:cursor-not-allowed
                      disabled:opacity-25
                    "
                  >
                    <Trash2
                      className="h-3.5 w-3.5"
                    />

                    Delete Saved Views
                  </button>
                </SettingRow>
              </SectionCard>
            ) : null}


            {activeSection ===
            "analysis" ? (
              <SectionCard
                title="Analysis"
                description="Control background library-analysis behavior."
                icon={Gauge}
              >
                <SettingRow
                  title="Concurrent games"
                  description="Maximum number of games analyzed at the same time. Two is recommended to stay responsive and avoid excessive external requests."
                >
                  <Select
                    value={
                      String(
                        settings
                          .analysisConcurrency
                      )
                    }
                    onChange={
                      (value) =>
                        changeSetting(
                          "analysisConcurrency",
                          Number(value)
                        )
                    }
                  >
                    <option value="1">
                      1 game
                    </option>

                    <option value="2">
                      2 games — Recommended
                    </option>

                    <option value="3">
                      3 games
                    </option>

                    <option value="4">
                      4 games
                    </option>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Analysis freshness"
                  description="Successfully analyzed games younger than this age are skipped by Analyze Library."
                >
                  <Select
                    value={
                      String(
                        settings
                          .analysisFreshDays
                      )
                    }
                    onChange={
                      (value) =>
                        changeSetting(
                          "analysisFreshDays",
                          Number(value)
                        )
                    }
                  >
                    <option value="1">
                      1 day
                    </option>

                    <option value="3">
                      3 days
                    </option>

                    <option value="7">
                      7 days — Recommended
                    </option>

                    <option value="14">
                      14 days
                    </option>

                    <option value="30">
                      30 days
                    </option>
                  </Select>
                </SettingRow>

                {settings.analysisConcurrency > 2 ? (
                  <div
                    className="
                      mt-4
                      rounded-xl
                      border
                      border-amber-500/15
                      bg-amber-500/[0.04]
                      px-4
                      py-3
                      text-xs
                      leading-relaxed
                      text-amber-200/65
                    "
                  >
                    Concurrency {settings.analysisConcurrency} is more aggressive than the recommended value of 2 and may increase rate-limit or timeout errors.
                  </div>
                ) : null}

                <SettingRow
                  title="Adaptive throttling"
                  description="If repeated transient service failures occur during background analysis, GameAtlas automatically reduces effective concurrency to 1 for the remainder of that run. Your saved setting is not changed."
                >
                  <span
                    className="
                      rounded-full
                      bg-emerald-500/10
                      px-3
                      py-1.5
                      text-xs
                      font-medium
                      text-emerald-300/70
                    "
                  >
                    Enabled
                  </span>
                </SettingRow>
              </SectionCard>
            ) : null}


            {activeSection ===
            "backups" ? (
              <SectionCard
                title="Backups"
                description="Configure save protection, automatic retention, and pre-launch backups."
                icon={Archive}
              >
                <SettingRow
                  title="Backup retention"
                  description="Limit the number of backups kept per game. Retention is applied after a new manual, pre-launch, or restore-safety backup is created."
                >
                  <Select
                    value={
                      String(
                        settings
                          .backupRetentionCount
                      )
                    }
                    onChange={
                      (value) =>
                        changeSetting(
                          "backupRetentionCount",
                          Number(value)
                        )
                    }
                  >
                    <option value="0">
                      Keep all backups
                    </option>

                    <option value="3">
                      Keep latest 3
                    </option>

                    <option value="5">
                      Keep latest 5
                    </option>

                    <option value="10">
                      Keep latest 10
                    </option>

                    <option value="20">
                      Keep latest 20
                    </option>
                  </Select>
                </SettingRow>

                <SettingRow
                  title="Backup before launch"
                  description="When enabled, GameAtlas creates a save backup before launching a game whenever a save location is known. If that backup fails, the game is not launched so the protection setting is never silently bypassed."
                >
                  <Toggle
                    checked={
                      settings
                        .backupBeforeLaunch
                    }
                    onChange={
                      (value) =>
                        changeSetting(
                          "backupBeforeLaunch",
                          value
                        )
                    }
                  />
                </SettingRow>

                <SettingRow
                  title="Restore safety backups"
                  description="GameAtlas always creates a safety backup before restoring an older save. This protection remains enabled regardless of the pre-launch setting."
                >
                  <span
                    className="
                      rounded-full
                      bg-emerald-500/[0.07]
                      px-3
                      py-1.5
                      text-xs
                      font-semibold
                      text-emerald-200/65
                    "
                  >
                    Always Enabled
                  </span>
                </SettingRow>

                <SettingRow
                  title="Backup storage"
                  description={
                    backupSummary
                      ? `${backupSummary.backupCount} backups across ${backupSummary.gameDirectoryCount} game folders · ${formatBytes(backupSummary.totalSizeBytes)} total.`
                      : "View total backup count and storage used across GameAtlas."
                  }
                >
                  <button
                    type="button"
                    onClick={
                      refreshBackupSummary
                    }
                    disabled={
                      backupSummaryLoading
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
                      text-white/55
                      hover:bg-white/[0.06]
                      disabled:opacity-30
                    "
                  >
                    <RefreshCcw
                      className={`
                        h-3.5
                        w-3.5
                        ${
                          backupSummaryLoading
                            ? "animate-spin"
                            : ""
                        }
                      `}
                    />

                    Refresh Storage
                  </button>
                </SettingRow>

                {backupSummary
                  ?.backupRoot ? (
                  <div
                    className="
                      py-3
                      text-[10px]
                      leading-relaxed
                      text-white/25
                    "
                  >
                    Storage location: {
                      backupSummary
                        .backupRoot
                    }
                  </div>
                ) : null}
              </SectionCard>
            ) : null}


            {activeSection ===
            "updates" ? (
              <SectionCard
                title="Updates"
                description="Control signed GameAtlas update checks."
                icon={RefreshCcw}
              >
                <SettingRow
                  title="Update service availability"
                  description={
                    networkOnline
                      ? "Internet connectivity is available for signed GitHub release checks."
                      : "GameAtlas is offline. Automatic and manual update checks resume when connectivity returns."
                  }
                >
                  <span
                    className={`
                      inline-flex
                      items-center
                      gap-2
                      rounded-full
                      px-3
                      py-1.5
                      text-xs
                      font-medium
                      ${
                        networkOnline
                          ? "bg-emerald-500/10 text-emerald-300/70"
                          : "bg-amber-500/10 text-amber-300/75"
                      }
                    `}
                  >
                    {networkOnline ? (
                      <Wifi
                        className="h-3.5 w-3.5"
                      />
                    ) : (
                      <WifiOff
                        className="h-3.5 w-3.5"
                      />
                    )}

                    {networkOnline
                      ? "Online"
                      : "Offline"}
                  </span>
                </SettingRow>

                <SettingRow
                  title="Check automatically at startup"
                  description="Silently check GitHub Releases when GameAtlas opens. Offline failures remain silent."
                >
                  <Toggle
                    checked={
                      settings
                        .automaticUpdateChecks
                    }
                    onChange={
                      (value) =>
                        changeSetting(
                          "automaticUpdateChecks",
                          value
                        )
                    }
                  />
                </SettingRow>

                <SettingRow
                  title="Manual update check"
                  description="Check for a newer signed GameAtlas release right now."
                >
                  <button
                    type="button"
                    onClick={
                      onCheckForUpdates
                    }
                    disabled={
                      !onCheckForUpdates
                      ||
                      !networkOnline
                      ||
                      updateCheckStatus
                        ?.state ===
                        "checking"
                    }
                    className="
                      inline-flex
                      items-center
                      gap-2
                      rounded-lg
                      bg-cyan-500/12
                      px-3
                      py-2
                      text-xs
                      font-semibold
                      text-cyan-200
                      hover:bg-cyan-500/20
                      disabled:cursor-wait
                      disabled:opacity-40
                    "
                  >
                    {updateCheckStatus
                      ?.state ===
                      "checking" ? (
                      <LoaderCircle
                        className="
                          h-3.5
                          w-3.5
                          animate-spin
                        "
                      />
                    ) : (
                      <RefreshCcw
                        className="h-3.5 w-3.5"
                      />
                    )}

                    Check for Updates
                  </button>
                </SettingRow>

                {updateCheckStatus
                  ?.message ? (
                  <div
                    className="
                      py-4
                      text-xs
                      text-white/45
                    "
                  >
                    {
                      updateCheckStatus
                        .message
                    }
                  </div>
                ) : null}
              </SectionCard>
            ) : null}


            {activeSection ===
            "appearance" ? (
              <SectionCard
                title="Appearance"
                description="Adjust GameAtlas's interface density."
                icon={Sparkles}
              >
                <SettingRow
                  title="Compact game list"
                  description="Reduce game-row spacing in the sidebar so more titles fit on screen at once."
                >
                  <Toggle
                    checked={
                      settings
                        .compactGameRows
                    }
                    onChange={
                      (value) =>
                        changeSetting(
                          "compactGameRows",
                          value
                        )
                    }
                  />
                </SettingRow>

              </SectionCard>
            ) : null}


            {activeSection ===
            "cache" ? (
              <SectionCard
                title="Cache Controls"
                description="Refresh analysis data without deleting personal library information."
                icon={Database}
              >
                <div
                  className="
                    mb-1
                    flex
                    items-start
                    gap-2
                    rounded-xl
                    border
                    border-cyan-500/10
                    bg-cyan-500/[0.025]
                    px-3
                    py-2.5
                    text-[11px]
                    leading-relaxed
                    text-white/32
                  "
                >
                  <Bookmark
                    className="
                      mt-0.5
                      h-3.5
                      w-3.5
                      shrink-0
                      text-cyan-300/55
                    "
                  />

                  Saved Views are treated as personal library preferences and are never removed by safe-cache actions. They can be deleted explicitly from Settings → Library.
                </div>

                <SettingRow
                  title="Analysis cache"
                  description={`${cacheSummary.analysisEntries} analyzed game entries · ${formatBytes(cacheSummary.analysisBytes)}. Clearing this causes Analyze Library to refresh those games again.`}
                >
                  <button
                    type="button"
                    onClick={
                      () => {
                        clearAnalysisCache();

                        refreshCacheSummary(
                          "Analysis cache cleared."
                        );
                      }
                    }
                    className="
                      rounded-lg
                      border
                      border-amber-500/20
                      bg-amber-500/[0.06]
                      px-3
                      py-2
                      text-xs
                      text-amber-200/75
                      hover:bg-amber-500/[0.1]
                    "
                  >
                    Clear Analysis
                  </button>
                </SettingRow>

                <SettingRow
                  title="Library filter preferences"
                  description={`Saved sidebar filter state · ${formatBytes(cacheSummary.filterBytes)}. Favorites and tags are stored separately and are not affected.`}
                >
                  <button
                    type="button"
                    onClick={
                      () => {
                        clearLibraryFilterCache();

                        refreshCacheSummary(
                          "Library filter preferences cleared."
                        );
                      }
                    }
                    className="
                      rounded-lg
                      border
                      border-white/[0.08]
                      bg-white/[0.025]
                      px-3
                      py-2
                      text-xs
                      text-white/55
                      hover:bg-white/[0.06]
                    "
                  >
                    Clear Filters
                  </button>
                </SettingRow>

                <SettingRow
                  title="External service status"
                  description={`${cacheSummary.serviceStatusEntries ?? 0} cached service records · ${formatBytes(cacheSummary.serviceStatusBytes ?? 0)}. Clearing this resets PCGamingWiki, RenoDX, Luma, Vortex, and GitHub status to unknown until they are checked again.`}
                >
                  <button
                    type="button"
                    onClick={
                      () => {
                        clearExternalServiceStatusCache();

                        refreshCacheSummary(
                          "External service status cleared."
                        );
                      }
                    }
                    className="
                      rounded-lg
                      border
                      border-white/[0.08]
                      bg-white/[0.025]
                      px-3
                      py-2
                      text-xs
                      text-white/55
                      hover:bg-white/[0.06]
                    "
                  >
                    Clear Service Status
                  </button>
                </SettingRow>

                <SettingRow
                  title="Installation Health assessments"
                  description={`${cacheSummary.installationHealthEntries ?? 0} stored health assessments · ${formatBytes(cacheSummary.installationHealthBytes ?? 0)}. Clearing these returns dashboard health categories to Not Assessed until games are checked again.`}
                >
                  <button
                    type="button"
                    onClick={
                      () => {
                        const confirmed =
                          window.confirm(
                            "Clear stored Installation Health assessments? This does not delete games, backups, or save data."
                          );

                        if (!confirmed) {
                          return;
                        }

                        clearInstallationHealthCache();

                        refreshCacheSummary(
                          "Installation Health assessments cleared."
                        );
                      }
                    }
                    className="
                      rounded-lg
                      border
                      border-white/[0.08]
                      bg-white/[0.025]
                      px-3
                      py-2
                      text-xs
                      text-white/55
                      hover:bg-white/[0.06]
                    "
                  >
                    Clear Health Assessments
                  </button>
                </SettingRow>

                <SettingRow
                  title="Clear safe caches"
                  description="Clears analysis data, filter preferences, external-service status, and Installation Health assessments. It does not delete favorites, tags, hidden games, Saved Views, save backups, settings, or updater information."
                >
                  <button
                    type="button"
                    onClick={
                      () => {
                        clearSafeCaches();

                        refreshCacheSummary(
                          "Safe caches cleared."
                        );
                      }
                    }
                    className="
                      rounded-lg
                      border
                      border-red-500/20
                      bg-red-500/[0.06]
                      px-3
                      py-2
                      text-xs
                      font-medium
                      text-red-200/75
                      hover:bg-red-500/[0.1]
                    "
                  >
                    Clear Safe Caches
                  </button>
                </SettingRow>

                {cacheMessage ? (
                  <div
                    className="
                      py-4
                      text-xs
                      text-emerald-300/65
                    "
                  >
                    {cacheMessage}
                  </div>
                ) : null}
              </SectionCard>
            ) : null}


            {activeSection ===
            "diagnostics" ? (
              <SectionCard
                title="Diagnostics"
                description="Collect privacy-conscious support information for troubleshooting GameAtlas."
                icon={Stethoscope}
              >
                <div
                  className="
                    pt-5
                  "
                >
                  <DiagnosticsPanel
                    games={
                      games
                    }
                    networkOnline={
                      networkOnline
                    }
                    updateCheckStatus={
                      updateCheckStatus
                    }
                  />
                </div>
              </SectionCard>
            ) : null}


            {activeSection ===
            "about" ? (
              <SectionCard
                title="About"
                description="Application and project information."
                icon={BadgeInfo}
              >
                <SettingRow
                  title={appName}
                  description="Windows desktop game-library manager built with Rust, Tauri, React, and Vite."
                >
                  <span
                    className="
                      text-xs
                      text-white/55
                    "
                  >
                    {appInfoLoading
                      ? "Reading version…"
                      : `Version ${version ?? "Unknown"}`}
                  </span>
                </SettingRow>

                <SettingRow
                  title="Repository"
                  description="Open the GameAtlas GitHub repository."
                >
                  <button
                    type="button"
                    onClick={
                      () =>
                        openUrl(
                          REPOSITORY_URL
                        )
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
                      text-white/55
                      hover:bg-white/[0.06]
                    "
                  >
                    <ExternalLink
                      className="h-3.5 w-3.5"
                    />

                    GitHub
                  </button>
                </SettingRow>
              </SectionCard>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
