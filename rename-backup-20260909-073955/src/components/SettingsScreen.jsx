import {
  Archive,
  BadgeInfo,
  Database,
  ExternalLink,
  Gauge,
  Library,
  LoaderCircle,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Sparkles,
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
  clearAnalysisCache,
  clearLibraryFilterCache,
  clearSafeCaches,
  getCacheSummary,
  getSettings,
  resetSettings,
  updateSettings,
} from "../services/settings";


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
  if (!bytes) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${
    (
      bytes /
      1024
    ).toFixed(
      1
    )
  } KB`;
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
    appName,
    setAppName,
  ] =
    useState(
      "Game Manager"
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
                || "Game Manager"
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
    const next =
      resetSettings();

    setSettings(
      next
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
                  Game Manager preferences
                </div>
              </div>

              <div
                className="
                  grid
                  grid-cols-2
                  gap-1
                  sm:grid-cols-4
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


            {activeSection ===
            "general" ? (
              <SectionCard
                title="General"
                description="Core application behavior."
                icon={Settings2}
              >
                <SettingRow
                  title="Startup destination"
                  description="Choose which screen Game Manager opens to after the library scan begins."
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
                  description="Restore Game Manager settings to their v1.1 defaults. Favorites, tags, hidden games, backups, and analysis data are not removed."
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
                  description="Open the sidebar in the Hidden Games view when Game Manager starts."
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
                  description="Installed Steam, Epic, GOG, and Ubisoft games are scanned when Game Manager starts. A manual Rescan button remains available in the sidebar."
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
              </SectionCard>
            ) : null}


            {activeSection ===
            "backups" ? (
              <SectionCard
                title="Backups"
                description="Save-backup behavior and future retention controls."
                icon={Archive}
              >
                <SettingRow
                  title="Current backup behavior"
                  description="Game Manager creates timestamped per-game backups and automatically creates a safety backup before restoring an older backup."
                >
                  <span
                    className="
                      text-xs
                      font-medium
                      text-white/55
                    "
                  >
                    Keep all backups
                  </span>
                </SettingRow>

                <SettingRow
                  title="Retention & backup-before-launch"
                  description="These controls are intentionally not exposed until the backup engine implements them, so the Settings screen never presents a switch that does nothing."
                >
                  <span
                    className="
                      rounded-full
                      bg-white/[0.04]
                      px-3
                      py-1.5
                      text-xs
                      text-white/35
                    "
                  >
                    Planned for v1.1
                  </span>
                </SettingRow>
              </SectionCard>
            ) : null}


            {activeSection ===
            "updates" ? (
              <SectionCard
                title="Updates"
                description="Control signed Game Manager update checks."
                icon={RefreshCcw}
              >
                <SettingRow
                  title="Check automatically at startup"
                  description="Silently check GitHub Releases when Game Manager opens. Offline failures remain silent."
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
                  description="Check for a newer signed Game Manager release right now."
                >
                  <button
                    type="button"
                    onClick={
                      onCheckForUpdates
                    }
                    disabled={
                      !onCheckForUpdates
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
                description="Adjust Game Manager's interface density."
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

                <SettingRow
                  title="Theme"
                  description="Game Manager currently uses its production dark interface. Additional themes can be added later without changing stored settings."
                >
                  <span
                    className="
                      rounded-full
                      bg-cyan-500/10
                      px-3
                      py-1.5
                      text-xs
                      text-cyan-200/70
                    "
                  >
                    Dark
                  </span>
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
                  title="Clear safe caches"
                  description="Clears analysis timestamps, library insights, and filter preferences. It does not delete favorites, tags, hidden games, save backups, or updater information."
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
                  description="Open the Game Manager GitHub repository."
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
