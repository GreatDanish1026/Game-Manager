import {
  Clock3,
  File,
  FolderOpen,
  Loader2,
  RefreshCcw,
  Save,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  inspectSaveBrowser,
} from "../services/saveBrowser";

import {
  openGamePath,
} from "../services/pathActions";

import {
  error as logError,
} from "../services/logging";


function formatSize(
  value
) {
  const bytes =
    Number(
      value
      ?? 0
    );

  if (
    !Number.isFinite(
      bytes
    )
    || bytes <= 0
  ) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  let size =
    bytes;

  let unit =
    0;

  while (
    size >= 1024
    && unit
      < units.length - 1
  ) {
    size /=
      1024;

    unit +=
      1;
  }

  return `${size.toFixed(
    unit === 0
      ? 0
      : size >= 100
        ? 0
        : size >= 10
          ? 1
          : 2
  )} ${units[unit]}`;
}


function formatDate(
  unix
) {
  const seconds =
    Number(
      unix
      ?? 0
    );

  if (
    !Number.isFinite(
      seconds
    )
    || seconds <= 0
  ) {
    return "Unknown";
  }

  return new Date(
    seconds * 1000
  )
    .toLocaleString();
}


function SummaryCard({
  label,
  value,
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
          text-[10px]
          font-semibold
          uppercase
          tracking-wide
          text-white/30
        "
      >
        {label}
      </div>

      <div
        className="
          mt-2
          break-words
          text-sm
          font-semibold
          text-white/70
        "
      >
        {value}
      </div>
    </div>
  );
}


export default function SaveBrowserPanel({
  game,
}) {
  const savePath =
    game?.technical
      ?.saveLocation;

  const [
    info,
    setInfo,
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
    if (!savePath) {
      return;
    }

    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const result =
        await inspectSaveBrowser(
          game
        );

      setInfo(
        result
      );
    } catch (loadError) {
      logError(
        "[Save Browser] Inspection failed:",
        loadError
      );

      setInfo(
        null
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
      setInfo(
        null
      );

      setError(
        null
      );

      if (savePath) {
        refresh();
      }
    },
    [
      game?.id,
      savePath,
      game?.installPath,
    ]
  );


  const recentFiles =
    useMemo(
      () =>
        info?.recentFiles
        ?? [],
      [
        info,
      ]
    );


  async function openFolder(
    path
  ) {
    if (!path) {
      return;
    }

    try {
      setError(
        null
      );

      await openGamePath(
        path,
        game?.installPath
        ?? null
      );
    } catch (openError) {
      logError(
        "[Save Browser] Open folder failed:",
        openError
      );

      setError(
        String(
          openError
        )
      );
    }
  }


  if (!savePath) {
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
        PCGamingWiki did not report a save location for this game, so Save Browser cannot inspect live save data.
      </div>
    );
  }


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
          lg:flex-row
          lg:items-start
          lg:justify-between
        "
      >
        <div
          className="
            min-w-0
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              text-sm
              font-semibold
              text-white/75
            "
          >
            <Save
              className="
                h-4
                w-4
                text-cyan-300
              "
            />

            Live Save Data
          </div>

          <div
            className="
              mt-2
              break-words
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            {info?.resolvedPath
              ?? savePath}
          </div>

          {info?.scanTruncated ? (
            <div
              className="
                mt-2
                text-xs
                text-amber-200/60
              "
            >
              Save scan reached its safety limit. Counts and totals may be partial.
            </div>
          ) : null}
        </div>

        <div
          className="
            flex
            shrink-0
            flex-wrap
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              () =>
                openFolder(
                  info?.resolvedPath
                  ?? savePath
                )
            }
            disabled={
              !info?.resolvedPath
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
              text-white/50
              hover:bg-white/[0.055]
              hover:text-white/70
              disabled:opacity-30
            "
          >
            <FolderOpen
              className="h-3.5 w-3.5"
            />

            Open Save Folder
          </button>

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
      </div>


      {error ? (
        <div
          className="
            mt-3
            rounded-xl
            border
            border-amber-500/20
            bg-amber-500/[0.05]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-amber-200/70
          "
        >
          {error}
        </div>
      ) : null}


      {loading
        && !info ? (
        <div
          className="
            mt-3
            rounded-xl
            border
            border-white/[0.08]
            bg-black/10
            px-4
            py-10
            text-center
            text-sm
            text-white/30
          "
        >
          <Loader2
            className="
              mx-auto
              h-6
              w-6
              animate-spin
            "
          />

          <div
            className="mt-3"
          >
            Inspecting save data…
          </div>
        </div>
      ) : null}


      {info ? (
        <>
          <div
            className="
              mt-3
              grid
              grid-cols-1
              gap-3
              sm:grid-cols-2
              xl:grid-cols-4
            "
          >
            <SummaryCard
              label="Save Files"
              value={
                info.fileCount
                  .toLocaleString()
              }
            />

            <SummaryCard
              label="Total Save Size"
              value={
                formatSize(
                  info.totalSizeBytes
                )
              }
            />

            <SummaryCard
              label="Newest Save"
              value={
                info.newestFile
                  ? formatDate(
                      info
                        .newestFile
                        .modifiedUnix
                    )
                  : "None"
              }
            />

            <SummaryCard
              label="Oldest Save"
              value={
                info.oldestFile
                  ? formatDate(
                      info
                        .oldestFile
                        .modifiedUnix
                    )
                  : "None"
              }
            />
          </div>


          <div
            className="
              mt-3
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
                border-white/[0.07]
                px-4
                py-3
              "
            >
              <div
                className="
                  text-sm
                  font-semibold
                  text-white/70
                "
              >
                Recently Modified Save Files
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  text-white/25
                "
              >
                Up to 25 files, newest first.
              </div>
            </div>


            {recentFiles.length === 0 ? (
              <div
                className="
                  px-4
                  py-10
                  text-center
                "
              >
                <Clock3
                  className="
                    mx-auto
                    h-7
                    w-7
                    text-white/15
                  "
                />

                <div
                  className="
                    mt-3
                    text-sm
                    font-semibold
                    text-white/35
                  "
                >
                  No save files found
                </div>

                <div
                  className="
                    mt-1
                    text-xs
                    text-white/20
                  "
                >
                  The resolved save folder exists, but GameAtlas did not find any files inside it.
                </div>
              </div>
            ) : (
              <div
                className="
                  divide-y
                  divide-white/[0.06]
                "
              >
                {recentFiles.map(
                  (
                    file
                  ) => (
                    <div
                      key={
                        file.path
                      }
                      className="
                        flex
                        flex-col
                        gap-3
                        px-4
                        py-3.5
                        md:flex-row
                        md:items-center
                        md:justify-between
                      "
                    >
                      <div
                        className="
                          flex
                          min-w-0
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
                            text-cyan-300/65
                          "
                        >
                          <File
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
                              truncate
                              text-sm
                              font-semibold
                              text-white/65
                            "
                          >
                            {file.fileName}
                          </div>

                          <div
                            className="
                              mt-1
                              break-all
                              font-mono
                              text-[10px]
                              text-white/20
                            "
                          >
                            {file.relativePath}
                          </div>

                          <div
                            className="
                              mt-1
                              text-[10px]
                              text-white/25
                            "
                          >
                            {formatSize(
                              file.sizeBytes
                            )}
                            {" • "}
                            {formatDate(
                              file.modifiedUnix
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={
                          () =>
                            openFolder(
                              file.parentPath
                            )
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
                        "
                      >
                        <FolderOpen
                          className="h-3.5 w-3.5"
                        />

                        Open Location
                      </button>
                    </div>
                  )
                )}
              </div>
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
            Save Browser only inspects live save data. It does not modify or restore files. Use the separate Save Backups card for backup and restore operations.
          </div>
        </>
      ) : null}
    </div>
  );
}
