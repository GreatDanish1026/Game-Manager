import {
  Bug,
  FileCode2,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCcw,
  Save,
  ScrollText,
  Sparkles,
  TerminalSquare,
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
  inspectGameUtilityDirectories,
} from "../services/gameFileUtilities";

import {
  openGamePath,
} from "../services/pathActions";

import {
  error as logError,
} from "../services/logging";


function UtilityCard({
  icon: Icon,
  title,
  description,
  path,
  actionLabel,
  onOpen,
}) {
  const available =
    Boolean(
      path
    );

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
          items-start
          gap-3
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
              flex-wrap
              items-center
              justify-between
              gap-2
            "
          >
            <div
              className="
                text-sm
                font-semibold
                text-white/70
              "
            >
              {title}
            </div>

            <span
              className={`
                rounded-full
                border
                px-2
                py-0.5
                text-[9px]
                font-semibold
                uppercase
                tracking-wide
                ${
                  available
                    ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200/60"
                    : "border-white/[0.07] bg-white/[0.02] text-white/25"
                }
              `}
            >
              {available
                ? "Available"
                : "Not Detected"}
            </span>
          </div>

          <div
            className="
              mt-1
              text-xs
              leading-relaxed
              text-white/28
            "
          >
            {description}
          </div>

          <div
            className="
              mt-3
              min-h-[32px]
              break-all
              rounded-lg
              border
              border-white/[0.06]
              bg-white/[0.015]
              px-3
              py-2
              font-mono
              text-[10px]
              leading-relaxed
              text-white/28
            "
          >
            {path
              || "No usable path detected."}
          </div>

          <button
            type="button"
            onClick={
              onOpen
            }
            disabled={
              !available
            }
            className="
              mt-3
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
              text-white/45
              hover:bg-white/[0.055]
              hover:text-white/65
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            <FolderOpen
              className="h-3.5 w-3.5"
            />

            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function GameFileUtilitiesPanel({
  game,
}) {
  const [
    local,
    setLocal,
  ] =
    useState(null);

  const [
    directories,
    setDirectories,
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
      const [
        localResult,
        directoryResult,
      ] =
        await Promise.all([
          game?.installPath
            ? inspectLocalInstallation(
                game
              )
            : Promise.resolve(
                null
              ),

          inspectGameUtilityDirectories(
            game
          ),
        ]);

      setLocal(
        localResult
      );

      setDirectories(
        directoryResult
      );
    } catch (refreshError) {
      logError(
        "[Game File Utilities] Refresh failed:",
        refreshError
      );

      setError(
        String(
          refreshError
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      setLocal(
        null
      );

      setDirectories(
        null
      );

      setError(
        null
      );

      refresh();
    },
    [
      game?.id,
      game?.installPath,
      game?.technical
        ?.configLocation,
      game?.technical
        ?.saveLocation,
    ]
  );


  const executablePath =
    local?.executable
      ?.path
    ?? null;

  const executableFolder =
    useMemo(
      () => {
        if (
          !executablePath
        ) {
          return null;
        }

        const normalized =
          executablePath
            .replaceAll(
              "/",
              "\\"
            );

        const index =
          normalized
            .lastIndexOf(
              "\\"
            );

        if (
          index <= 2
        ) {
          return null;
        }

        return normalized
          .slice(
            0,
            index
          );
      },
      [
        executablePath,
      ]
    );


  async function openPath(
    path
  ) {
    if (!path) {
      return;
    }

    setError(
      null
    );

    try {
      await openGamePath(
        path,
        game?.installPath
        ?? null
      );
    } catch (openError) {
      logError(
        "[Game File Utilities] Open failed:",
        openError
      );

      setError(
        String(
          openError
        )
      );
    }
  }


  const items = [
    {
      icon:
        HardDrive,

      title:
        "Install Folder",

      description:
        "The game's main installation directory.",

      path:
        game?.installPath,

      actionLabel:
        "Open Install Folder",
    },

    {
      icon:
        TerminalSquare,

      title:
        "Executable Folder",

      description:
        "Folder containing GameAtlas's detected main executable.",

      path:
        executableFolder,

      actionLabel:
        "Open Executable Folder",
    },

    {
      icon:
        FileCode2,

      title:
        "Configuration",

      description:
        "PCGamingWiki-reported configuration location.",

      path:
        game?.technical
          ?.configLocation,

      actionLabel:
        "Open Config Folder",
    },

    {
      icon:
        Save,

      title:
        "Save Data",

      description:
        "PCGamingWiki-reported live save-data location.",

      path:
        game?.technical
          ?.saveLocation,

      actionLabel:
        "Open Save Folder",
    },

    {
      icon:
        ScrollText,

      title:
        "Logs",

      description:
        "Common log directory detected inside the installation.",

      path:
        directories
          ?.logDirectory,

      actionLabel:
        "Open Logs",
    },

    {
      icon:
        Bug,

      title:
        "Crash Reports",

      description:
        "Common crash-report or crash-dump directory detected inside the installation.",

      path:
        directories
          ?.crashDirectory,

      actionLabel:
        "Open Crash Folder",
    },

    {
      icon:
        Sparkles,

      title:
        "Shader / Pipeline Cache",

      description:
        "Common game-local shader or pipeline cache directory when detected.",

      path:
        directories
          ?.shaderCacheDirectory,

      actionLabel:
        "Open Cache Folder",
    },
  ];


  const availableCount =
    items.filter(
      (
        item
      ) =>
        Boolean(
          item.path
        )
    ).length;


  return (
    <div>
      <div
        className="
          flex
          flex-col
          gap-3
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
          md:flex-row
          md:items-center
          md:justify-between
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
            {availableCount} file location{availableCount === 1 ? "" : "s"} available
          </div>

          <div
            className="
              mt-1
              text-xs
              leading-relaxed
              text-white/30
            "
          >
            Quick navigation to game files GameAtlas can identify with confidence.
          </div>

          {directories
            ?.scanTruncated ? (
            <div
              className="
                mt-2
                text-xs
                text-amber-200/60
              "
            >
              Directory discovery reached its safety limit. Optional locations may be incomplete.
            </div>
          ) : null}
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
            inline-flex
            shrink-0
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            border-white/[0.08]
            bg-white/[0.025]
            px-3
            py-2
            text-xs
            font-semibold
            text-white/45
            hover:bg-white/[0.055]
            hover:text-white/65
            disabled:opacity-30
          "
        >
          {loading ? (
            <Loader2
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

          Refresh
        </button>
      </div>


      {error ? (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-amber-500/20
            bg-amber-500/[0.05]
            px-3
            py-2.5
            text-xs
            leading-relaxed
            text-amber-200/70
          "
        >
          {error}
        </div>
      ) : null}


      <div
        className="
          mt-3
          grid
          grid-cols-1
          gap-3
          xl:grid-cols-2
        "
      >
        {items.map(
          (
            item
          ) => (
            <UtilityCard
              key={
                item.title
              }
              {...item}
              onOpen={
                () =>
                  openPath(
                    item.path
                  )
              }
            />
          )
        )}
      </div>


      <div
        className="
          mt-3
          rounded-lg
          border
          border-white/[0.06]
          bg-white/[0.015]
          px-3
          py-3
          text-[10px]
          leading-relaxed
          text-white/22
        "
      >
        Game File Utilities only opens locations. It does not delete caches, edit configuration files, modify saves, or remove crash data. Optional log, crash, and shader-cache locations are only shown when GameAtlas finds a matching directory.
      </div>
    </div>
  );
}
