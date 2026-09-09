import {
  ExternalLink,
  FolderOpen,
  Image,
  Images,
  Loader2,
  RefreshCcw,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  invoke,
} from "@tauri-apps/api/core";

import {
  clearLocalInstallationCache,
  inspectLocalInstallation,
} from "../services/localInstallation";

import {
  openGamePath,
} from "../services/pathActions";

import {
  error as logError,
} from "../services/logging";


function formatTimestamp(
  unixSeconds
) {
  const value =
    Number(
      unixSeconds
    );

  if (
    !Number.isFinite(
      value
    )
    || value <= 0
  ) {
    return "Unknown";
  }

  try {
    return new Intl.DateTimeFormat(
      undefined,
      {
        dateStyle:
          "medium",
        timeStyle:
          "short",
      }
    ).format(
      new Date(
        value * 1000
      )
    );
  } catch {
    return "Unknown";
  }
}


export default function ScreenshotBrowserPanel({
  game,
}) {
  const [
    installation,
    setInstallation,
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


  async function load({
    force = false,
  } = {}) {
    if (!game?.installPath) {
      setInstallation(
        null
      );

      return;
    }

    setLoading(
      true
    );

    setError(
      null
    );

    try {
      if (force) {
        clearLocalInstallationCache(
          game
        );
      }

      const result =
        await inspectLocalInstallation(
          game,
          {
            force,
          }
        );

      setInstallation(
        result
      );
    } catch (loadError) {
      logError(
        "[Screenshots] Detection failed:",
        loadError
      );

      setError(
        String(
          loadError
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
      load();
    },
    [
      game?.id,
      game?.installPath,
      game?.store,
      game?.launcherId,
    ]
  );


  const screenshots =
    installation
      ?.screenshots
    ?? {};

  async function openScreenshotsFolder() {
    if (!screenshots.folderPath) {
      return;
    }

    try {
      await openGamePath(
        screenshots.folderPath,
        game.installPath
      );
    } catch (actionError) {
      logError(
        "[Screenshots] Failed to open screenshot folder:",
        actionError
      );

      setError(
        String(
          actionError
        )
      );
    }
  }


  async function openNewestScreenshot() {
    if (!screenshots.newestPath) {
      return;
    }

    try {
      await invoke(
        "open_game_file",
        {
          path:
            screenshots.newestPath,
        }
      );
    } catch (actionError) {
      logError(
        "[Screenshots] Failed to open newest screenshot:",
        actionError
      );

      setError(
        String(
          actionError
        )
      );
    }
  }


  return (
    <div>
      <div
        className="
          flex
          flex-col
          gap-3
          sm:flex-row
          sm:items-start
          sm:justify-between
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
            Screenshot Browser
          </div>

          <div
            className="
              mt-1
              max-w-3xl
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            Detect Steam screenshots first, then check a small set of common game screenshot folders.
          </div>
        </div>

        <button
          type="button"
          onClick={
            () =>
              load({
                force:
                  true,
              })
          }
          disabled={
            loading
            || !game.installPath
          }
          className="
            inline-flex
            shrink-0
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
            hover:text-white/70
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

          {loading
            ? "Detecting…"
            : "Refresh"}
        </button>
      </div>


      {error ? (
        <div
          className="
            mt-4
            rounded-lg
            border
            border-amber-500/20
            bg-amber-500/[0.05]
            px-3
            py-2
            text-xs
            text-amber-200/70
          "
        >
          {error}
        </div>
      ) : null}


      <div
        className="
          mt-4
          grid
          grid-cols-1
          gap-3
          lg:grid-cols-3
        "
      >
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
              gap-3
            "
          >
            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-lg
                bg-cyan-500/10
                text-cyan-300
              "
            >
              <Images
                className="h-4 w-4"
              />
            </div>

            <div>
              <div
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/30
                "
              >
                Screenshot Count
              </div>

              <div
                className="
                  mt-1
                  text-xl
                  font-semibold
                  text-white/80
                "
              >
                {screenshots.found
                  ? screenshots.screenshotCount
                  : 0}
              </div>

              <div
                className="
                  mt-0.5
                  text-xs
                  text-white/30
                "
              >
                {screenshots.source
                  ?? "No folder detected"}
              </div>
            </div>
          </div>
        </div>


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
              gap-3
            "
          >
            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-lg
                bg-cyan-500/10
                text-cyan-300
              "
            >
              <Image
                className="h-4 w-4"
              />
            </div>

            <div
              className="
                min-w-0
              "
            >
              <div
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/30
                "
              >
                Newest Screenshot
              </div>

              <div
                className="
                  mt-1
                  truncate
                  text-sm
                  font-semibold
                  text-white/75
                "
              >
                {screenshots.newestFileName
                  ?? "None detected"}
              </div>

              <div
                className="
                  mt-0.5
                  text-xs
                  text-white/30
                "
              >
                {screenshots.newestModifiedUnix
                  ? formatTimestamp(
                      screenshots.newestModifiedUnix
                    )
                  : "No timestamp available"}
              </div>
            </div>
          </div>
        </div>


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
              text-[10px]
              font-semibold
              uppercase
              tracking-wide
              text-white/30
            "
          >
            Actions
          </div>

          <div
            className="
              mt-3
              flex
              flex-wrap
              gap-2
            "
          >
            <button
              type="button"
              onClick={
                openScreenshotsFolder
              }
              disabled={
                !screenshots.folderPath
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-lg
                border
                border-white/[0.09]
                bg-white/[0.03]
                px-3
                py-2
                text-xs
                font-semibold
                text-white/55
                hover:bg-white/[0.06]
                hover:text-white/75
                disabled:opacity-25
              "
            >
              <FolderOpen
                className="h-3.5 w-3.5"
              />

              Open Folder
            </button>

            <button
              type="button"
              onClick={
                openNewestScreenshot
              }
              disabled={
                !screenshots.newestPath
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-lg
                border
                border-white/[0.09]
                bg-white/[0.03]
                px-3
                py-2
                text-xs
                font-semibold
                text-white/55
                hover:bg-white/[0.06]
                hover:text-white/75
                disabled:opacity-25
              "
            >
              <ExternalLink
                className="h-3.5 w-3.5"
              />

              Open Newest
            </button>
          </div>
        </div>
      </div>


      {screenshots.folderPath ? (
        <div
          className="
            mt-3
            break-all
            rounded-lg
            border
            border-white/[0.06]
            bg-black/10
            px-3
            py-2
            text-[10px]
            leading-relaxed
            text-white/20
          "
        >
          {screenshots.folderPath}
        </div>
      ) : (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-white/[0.06]
            bg-black/10
            px-3
            py-3
            text-xs
            leading-relaxed
            text-white/30
          "
        >
          No screenshot folder was detected for this game. Steam screenshots are checked using the game's Steam App ID; non-Steam games use conservative common-folder detection.
        </div>
      )}
    </div>
  );
}
