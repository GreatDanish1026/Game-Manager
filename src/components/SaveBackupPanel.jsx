import {
  Archive,
  FolderOpen,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Save,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createSaveBackup,
  getSaveBackupStatus,
  restoreSaveBackup,
} from "../services/saveBackups";

import {
  openGamePath,
} from "../services/pathActions";


function formatSize(
  bytes
) {
  if (
    bytes === null
    || bytes === undefined
  ) {
    return "Unknown size";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  let value =
    Number(
      bytes
    );

  let unit =
    0;

  while (
    value >= 1024
    && unit
      < units.length - 1
  ) {
    value /=
      1024;

    unit +=
      1;
  }

  return `${value.toFixed(
    unit === 0
      ? 0
      : 1
  )} ${units[unit]}`;
}


function formatDate(
  unix
) {
  if (!unix) {
    return "Unknown date";
  }

  return new Date(
    unix * 1000
  ).toLocaleString();
}


function BackupRow({
  backup,
  restoring,
  onRestore,
}) {
  const isSafety =
    backup.fileName
      ?.startsWith(
        "pre_restore_"
      );

  return (
    <div
      className="
        flex
        flex-col
        gap-3
        border-b
        border-white/[0.06]
        px-4
        py-3.5
        last:border-b-0
        sm:flex-row
        sm:items-center
        sm:justify-between
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
            flex-wrap
            items-center
            gap-2
          "
        >
          <div
            className="
              truncate
              text-sm
              font-medium
              text-white/75
            "
          >
            {formatDate(
              backup.modifiedUnix
            )}
          </div>

          {isSafety ? (
            <div
              className="
                rounded-full
                border
                border-amber-500/20
                bg-amber-500/[0.06]
                px-2
                py-0.5
                text-[10px]
                font-semibold
                uppercase
                tracking-wide
                text-amber-300/75
              "
            >
              Safety Backup
            </div>
          ) : null}
        </div>

        <div
          className="
            mt-1
            text-xs
            text-white/35
          "
        >
          {formatSize(
            backup.sizeBytes
          )}
          {" • "}
          {backup.fileName}
        </div>
      </div>

      <button
        type="button"
        onClick={
          onRestore
        }
        disabled={
          restoring
        }
        className="
          inline-flex
          shrink-0
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
          text-white/60
          transition
          hover:bg-white/[0.07]
          hover:text-white/80
          disabled:cursor-not-allowed
          disabled:opacity-35
        "
      >
        {restoring ? (
          <Loader2
            className="
              h-3.5
              w-3.5
              animate-spin
            "
          />
        ) : (
          <RotateCcw
            className="h-3.5 w-3.5"
          />
        )}

        Restore
      </button>
    </div>
  );
}


export default function SaveBackupPanel({
  game,
}) {
  const savePath =
    game?.technical
      ?.saveLocation;

  const [
    status,
    setStatus,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  const [
    restoring,
    setRestoring,
  ] =
    useState(null);

  const [
    error,
    setError,
  ] =
    useState(null);

  const [
    message,
    setMessage,
  ] =
    useState(null);


  const backups =
    useMemo(
      () =>
        status?.backups
        ?? [],
      [
        status,
      ]
    );


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
        await getSaveBackupStatus(
          game
        );

      setStatus(
        result
      );
    } catch (error) {
      console.error(
        "[Save Backups] Status failed:",
        error
      );

      setError(
        String(
          error
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
      setStatus(
        null
      );

      setMessage(
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
    ]
  );


  async function handleCreate() {
    setCreating(
      true
    );

    setError(
      null
    );

    setMessage(
      null
    );

    try {
      const result =
        await createSaveBackup(
          game
        );

      setStatus(
        result
      );

      setMessage(
        "Save backup created successfully."
      );
    } catch (error) {
      console.error(
        "[Save Backups] Create failed:",
        error
      );

      setError(
        String(
          error
        )
      );
    } finally {
      setCreating(
        false
      );
    }
  }


  async function handleRestore(
    backup
  ) {
    const confirmed =
      window.confirm(
        `Restore this save backup?\n\n${formatDate(
          backup.modifiedUnix
        )}\n\nGame Manager will automatically create a safety backup of your current save before restoring.`
      );

    if (!confirmed) {
      return;
    }

    setRestoring(
      backup.fileName
    );

    setError(
      null
    );

    setMessage(
      null
    );

    try {
      const result =
        await restoreSaveBackup(
          game,
          backup.fileName
        );

      setStatus(
        result
      );

      setMessage(
        "Save backup restored successfully. A safety backup of the previous save was created automatically."
      );
    } catch (error) {
      console.error(
        "[Save Backups] Restore failed:",
        error
      );

      setError(
        String(
          error
        )
      );
    } finally {
      setRestoring(
        null
      );
    }
  }


  async function handleOpenBackupFolder() {
    if (
      !status
        ?.backupDirectory
    ) {
      return;
    }

    try {
      await openGamePath(
        status.backupDirectory
      );
    } catch (error) {
      setError(
        String(
          error
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
        PCGamingWiki did not report a save location
        for this game, so automatic save backups are
        unavailable.
      </div>
    );
  }


  return (
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
          flex-col
          gap-4
          border-b
          border-white/[0.07]
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
            <Archive
              className="
                h-4
                w-4
                text-cyan-300
              "
            />

            Save Backup Manager
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
            {status?.savePath
              ?? savePath}
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/30
            "
          >
            Backups are stored outside the game folder
            in Game Manager's local backup directory.
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
              handleOpenBackupFolder
            }
            disabled={
              !status
                ?.backupDirectory
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-white/10
              bg-white/[0.035]
              px-3
              py-2
              text-xs
              font-medium
              text-white/60
              transition
              hover:bg-white/[0.07]
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            <FolderOpen
              className="h-3.5 w-3.5"
            />

            Backup Folder
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
              border-white/10
              bg-white/[0.035]
              px-3
              py-2
              text-xs
              font-medium
              text-white/60
              transition
              hover:bg-white/[0.07]
              disabled:opacity-30
            "
          >
            <RefreshCcw
              className={`
                h-3.5
                w-3.5
                ${
                  loading
                    ? "animate-spin"
                    : ""
                }
              `}
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={
              handleCreate
            }
            disabled={
              creating
              || restoring
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-cyan-500/25
              bg-cyan-500/[0.08]
              px-3
              py-2
              text-xs
              font-semibold
              text-cyan-200
              transition
              hover:bg-cyan-500/[0.13]
              disabled:cursor-not-allowed
              disabled:opacity-35
            "
          >
            {creating ? (
              <Loader2
                className="
                  h-3.5
                  w-3.5
                  animate-spin
                "
              />
            ) : (
              <Save
                className="h-3.5 w-3.5"
              />
            )}

            Create Backup
          </button>
        </div>
      </div>


      {error ? (
        <div
          className="
            border-b
            border-red-500/15
            bg-red-500/[0.05]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-red-300/75
          "
        >
          {error}
        </div>
      ) : null}


      {message ? (
        <div
          className="
            border-b
            border-emerald-500/15
            bg-emerald-500/[0.05]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-emerald-300/75
          "
        >
          {message}
        </div>
      ) : null}


      {loading
        && !status ? (
        <div
          className="
            flex
            items-center
            gap-3
            px-4
            py-5
            text-sm
            text-white/35
          "
        >
          <Loader2
            className="
              h-4
              w-4
              animate-spin
            "
          />

          Loading save backups...
        </div>
      ) : backups.length === 0 ? (
        <div
          className="
            px-4
            py-6
            text-center
          "
        >
          <div
            className="
              text-sm
              font-medium
              text-white/50
            "
          >
            No backups yet
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/30
            "
          >
            Create your first backup before changing
            mods, settings, or starting a risky section
            of the game.
          </div>
        </div>
      ) : (
        <div>
          {backups.map(
            (backup) => (
              <BackupRow
                key={
                  backup.fileName
                }
                backup={
                  backup
                }
                restoring={
                  restoring
                    === backup.fileName
                }
                onRestore={
                  () =>
                    handleRestore(
                      backup
                    )
                }
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
