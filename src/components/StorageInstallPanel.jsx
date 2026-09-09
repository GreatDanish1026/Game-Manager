import {
  Database,
  File,
  FolderCog,
  FolderOpen,
  Gauge,
  HardDrive,
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
  clearLocalInstallationCache,
  inspectLocalInstallation,
} from "../services/localInstallation";

import {
  openGamePath,
} from "../services/pathActions";

import {
  error as logError,
} from "../services/logging";


function formatBytes(
  value
) {
  const bytes =
    Number(
      value
    );

  if (
    !Number.isFinite(
      bytes
    )
    || bytes < 0
  ) {
    return "Unknown";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(
          bytes
        )
        / Math.log(
          1024
        )
      ),
      units.length
        - 1
    );

  const size =
    bytes
    / (
      1024
      ** index
    );

  return `${size >= 100 ? size.toFixed(0) : size >= 10 ? size.toFixed(1) : size.toFixed(2)} ${units[index]}`;
}


function MetricCard({
  icon: Icon,
  label,
  value,
  detail = null,
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
              mt-1.5
              text-lg
              font-semibold
              text-white/80
            "
          >
            {value}
          </div>

          {detail ? (
            <div
              className="
                mt-1
                text-xs
                leading-relaxed
                text-white/35
              "
            >
              {detail}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


function PathStorageCard({
  icon: Icon,
  title,
  info,
  rawPath,
  installPath,
}) {
  async function handleOpen() {
    if (
      !rawPath
      || !installPath
    ) {
      return;
    }

    try {
      await openGamePath(
        rawPath,
        installPath
      );
    } catch (error) {
      logError(
        `[Storage] Failed to open ${title}:`,
        error
      );
    }
  }


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
          justify-between
          gap-3
        "
      >
        <div
          className="
            flex
            min-w-0
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

            <div
              className="
                mt-1.5
                text-lg
                font-semibold
                text-white/80
              "
            >
              {info?.available
                ? formatBytes(
                    info.sizeBytes
                  )
                : "Not available"}
            </div>

            {info?.available ? (
              <div
                className="
                  mt-1
                  text-xs
                  text-white/35
                "
              >
                {info.fileCount ?? 0} files
                {info.truncated
                  ? " · partial scan"
                  : ""}
              </div>
            ) : null}

            {info?.resolvedPath ? (
              <div
                className="
                  mt-2
                  break-all
                  text-[10px]
                  leading-relaxed
                  text-white/20
                "
              >
                {info.resolvedPath}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={
            handleOpen
          }
          disabled={
            !rawPath
          }
          className="
            inline-flex
            shrink-0
            items-center
            gap-1.5
            rounded-lg
            border
            border-white/[0.08]
            bg-white/[0.025]
            px-2.5
            py-2
            text-[10px]
            font-semibold
            text-white/45
            hover:bg-white/[0.055]
            hover:text-white/70
            disabled:opacity-25
          "
        >
          <FolderOpen
            className="h-3.5 w-3.5"
          />

          Open
        </button>
      </div>
    </div>
  );
}


export default function StorageInstallPanel({
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
        "[Storage] Inspection failed:",
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
      game?.technical
        ?.saveLocation,
      game?.technical
        ?.configLocation,
    ]
  );


  const storage =
    installation
      ?.storageDetails
    ?? {};

  const usedDriveBytes =
    Number.isFinite(
      Number(
        storage.driveTotalBytes
      )
    )
    && Number.isFinite(
      Number(
        storage.driveFreeBytes
      )
    )
      ? Math.max(
          0,
          Number(
            storage.driveTotalBytes
          )
          - Number(
              storage.driveFreeBytes
            )
        )
      : null;

  const driveUsagePercent =
    usedDriveBytes !== null
    && Number(
      storage.driveTotalBytes
    ) > 0
      ? (
          usedDriveBytes
          / Number(
              storage.driveTotalBytes
            )
        )
        * 100
      : null;

  const largestFiles =
    useMemo(
      () =>
        Array.isArray(
          storage.largestFiles
        )
          ? storage
              .largestFiles
          : [],
      [
        storage.largestFiles,
      ]
    );


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
            Storage & Installation
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
            Local install size, drive capacity, executable size, save/config data, and largest installed files.
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
            ? "Calculating…"
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
          md:grid-cols-2
          xl:grid-cols-4
        "
      >
        <MetricCard
          icon={Database}
          label="Installed Size"
          value={
            formatBytes(
              storage.installSizeBytes
            )
          }
          detail={
            `${storage.installFileCount ?? 0} scanned files${storage.installSizeComplete === false ? " · partial because scan limit was reached" : ""}`
          }
        />

        <MetricCard
          icon={HardDrive}
          label="Install Drive"
          value={
            storage.driveRoot
            ?? "Unknown"
          }
          detail={
            storage.driveFreeBytes != null
              ? `${formatBytes(storage.driveFreeBytes)} free of ${formatBytes(storage.driveTotalBytes)}`
              : "Free-space information unavailable"
          }
        />

        <MetricCard
          icon={Gauge}
          label="Drive Usage"
          value={
            driveUsagePercent != null
              ? `${driveUsagePercent.toFixed(1)}% used`
              : "Unknown"
          }
          detail={
            usedDriveBytes != null
              ? `${formatBytes(usedDriveBytes)} currently used`
              : null
          }
        />

        <MetricCard
          icon={File}
          label="Main Executable"
          value={
            formatBytes(
              storage.executableSizeBytes
            )
          }
          detail={
            installation
              ?.executable
              ?.fileName
            ?? "Main executable not identified"
          }
        />
      </div>


      <div
        className="
          mt-3
          grid
          grid-cols-1
          gap-3
          lg:grid-cols-2
        "
      >
        <PathStorageCard
          icon={Save}
          title="Save Data"
          info={
            storage.saveData
          }
          rawPath={
            game.technical
              ?.saveLocation
          }
          installPath={
            game.installPath
          }
        />

        <PathStorageCard
          icon={FolderCog}
          title="Configuration Data"
          info={
            storage.configData
          }
          rawPath={
            game.technical
              ?.configLocation
          }
          installPath={
            game.installPath
          }
        />
      </div>


      <div
        className="
          mt-4
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
        "
      >
        <div
          className="
            text-sm
            font-semibold
            text-white/70
          "
        >
          Largest Installed Files
        </div>

        <div
          className="
            mt-1
            text-xs
            text-white/30
          "
        >
          Largest files found during the existing local installation scan.
        </div>

        {largestFiles.length > 0 ? (
          <div
            className="
              mt-3
              divide-y
              divide-white/[0.05]
            "
          >
            {largestFiles.map(
              (
                file
              ) => (
                <div
                  key={
                    file.relativePath
                  }
                  className="
                    flex
                    items-start
                    justify-between
                    gap-4
                    py-2.5
                  "
                >
                  <div
                    className="
                      min-w-0
                    "
                  >
                    <div
                      className="
                        truncate
                        text-xs
                        font-medium
                        text-white/55
                      "
                    >
                      {file.fileName}
                    </div>

                    <div
                      className="
                        mt-0.5
                        break-all
                        text-[10px]
                        text-white/20
                      "
                    >
                      {file.relativePath}
                    </div>
                  </div>

                  <div
                    className="
                      shrink-0
                      text-xs
                      font-semibold
                      text-white/45
                    "
                  >
                    {formatBytes(
                      file.sizeBytes
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div
            className="
              mt-3
              text-xs
              text-white/30
            "
          >
            No local file-size data is available.
          </div>
        )}
      </div>


      <div
        className="
          mt-3
          text-[10px]
          leading-relaxed
          text-white/20
        "
      >
        Install size is calculated from the files already visited by the local installation scanner, so it adds no second full install-directory walk. Save and config folders are measured separately only when their reported paths resolve locally.
      </div>
    </div>
  );
}
