import {
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileCode2,
  FolderOpen,
  HardDrive,
  Loader2,
  MonitorUp,
  Puzzle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  inspectLocalInstallation,
} from "../services/localInstallation";

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
    return "Unknown";
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


function StatusIcon({
  active,
}) {
  return active ? (
    <CheckCircle2
      className="
        h-4
        w-4
        shrink-0
        text-emerald-300/80
      "
    />
  ) : (
    <XCircle
      className="
        h-4
        w-4
        shrink-0
        text-white/18
      "
    />
  );
}


function TechnologyRow({
  label,
  active,
  version,
  detail,
  path,
  onOpen,
}) {
  return (
    <div
      className="
        flex
        flex-col
        gap-2
        border-b
        border-white/[0.055]
        px-4
        py-3
        last:border-b-0
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      <div
        className="
          flex
          min-w-0
          items-start
          gap-2.5
        "
      >
        <StatusIcon
          active={
            active
          }
        />

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
              className={`
                text-sm
                font-medium
                ${
                  active
                    ? "text-white/70"
                    : "text-white/32"
                }
              `}
            >
              {label}
            </div>

            {active
              && version ? (
              <span
                className="
                  rounded-full
                  border
                  border-cyan-400/20
                  bg-cyan-400/[0.06]
                  px-2
                  py-0.5
                  text-[10px]
                  font-semibold
                  text-cyan-200/70
                "
              >
                v{version}
              </span>
            ) : null}
          </div>

          {detail ? (
            <div
              className="
                mt-0.5
                break-all
                text-[11px]
                leading-relaxed
                text-white/28
              "
            >
              {detail}
            </div>
          ) : null}
        </div>
      </div>

      {active
        && path ? (
        <button
          type="button"
          onClick={
            () =>
              onOpen(
                path
              )
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
            py-1.5
            text-[11px]
            font-medium
            text-white/45
            transition
            hover:bg-white/[0.06]
            hover:text-white/70
          "
        >
          <FolderOpen
            className="h-3.5 w-3.5"
          />

          Open
        </button>
      ) : null}
    </div>
  );
}


function Group({
  icon: Icon,
  title,
  description,
  children,
}) {
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
          border-b
          border-white/[0.06]
          px-4
          py-3.5
        "
      >
        <div
          className="
            flex
            items-center
            gap-2
          "
        >
          <Icon
            className="
              h-4
              w-4
              text-cyan-300/80
            "
          />

          <div
            className="
              text-sm
              font-semibold
              text-white/72
            "
          >
            {title}
          </div>
        </div>

        {description ? (
          <div
            className="
              mt-1
              text-xs
              leading-relaxed
              text-white/30
            "
          >
            {description}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}


export default function LocalInstallationPanel({
  game,
}) {
  const [
    data,
    setData,
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
    if (
      !game
        ?.installPath
    ) {
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
        await inspectLocalInstallation(
          game,
          {
            force:
              true,
          }
        );

      setData(
        result
      );
    } catch (error) {
      console.error(
        "[Local Installation] Inspection failed:",
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
      setData(
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
    ]
  );


  async function handleOpen(
    path
  ) {
    try {
      await openGamePath(
        path
      );
    } catch (error) {
      setError(
        String(
          error
        )
      );
    }
  }


  if (
    !game
      ?.installPath
  ) {
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
        No local install path is available for this game.
      </div>
    );
  }


  return (
    <div
      className="
        space-y-4
      "
    >
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
              items-center
              gap-2
              text-sm
              font-semibold
              text-white/72
            "
          >
            <HardDrive
              className="
                h-4
                w-4
                text-cyan-300/80
              "
            />

            Local Installation Inspector
          </div>

          <div
            className="
              mt-1
              break-all
              text-xs
              text-white/30
            "
          >
            {data?.installPath
              ?? game.installPath}
          </div>

          {data ? (
            <div
              className="
                mt-1
                text-[11px]
                text-white/22
              "
            >
              {data.filesScanned?.toLocaleString()}
              {" "}
              files/folders inspected
              {data.scanTruncated
                ? " • scan limit reached"
                : ""
              }
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
            gap-2
            rounded-lg
            border
            border-white/[0.09]
            bg-white/[0.03]
            px-3
            py-2
            text-xs
            font-medium
            text-white/50
            transition
            hover:bg-white/[0.06]
            hover:text-white/75
            disabled:cursor-not-allowed
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

          Rescan
        </button>
      </div>


      {error ? (
        <div
          className="
            rounded-xl
            border
            border-red-500/20
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


      {loading
        && !data ? (
        <div
          className="
            flex
            items-center
            gap-3
            rounded-xl
            border
            border-white/[0.08]
            bg-black/10
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

          Inspecting the local game installation…
        </div>
      ) : null}


      {data ? (
        <>
          <Group
            icon={
              Cpu
            }
            title="Primary Executable"
            description="GameAtlas scores local executables to identify the most likely primary game binary."
          >
            {data.executable
              ?.found ? (
              <div
                className="
                  p-4
                "
              >
                <div
                  className="
                    flex
                    flex-col
                    gap-4
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
                      "
                    >
                      <FileCode2
                        className="
                          h-4
                          w-4
                          text-emerald-300/75
                        "
                      />

                      <span
                        className="
                          text-sm
                          font-semibold
                          text-white/75
                        "
                      >
                        {data.executable.fileName}
                      </span>
                    </div>

                    <div
                      className="
                        mt-2
                        grid
                        grid-cols-1
                        gap-x-8
                        gap-y-1.5
                        text-xs
                        text-white/35
                        sm:grid-cols-2
                      "
                    >
                      <div>
                        Architecture:{" "}
                        <span
                          className="
                            text-white/55
                          "
                        >
                          {data.executable.architecture
                            ?? "Unknown"
                          }
                        </span>
                      </div>

                      <div>
                        Size:{" "}
                        <span
                          className="
                            text-white/55
                          "
                        >
                          {formatSize(
                            data.executable.sizeBytes
                          )}
                        </span>
                      </div>
                    </div>

                    <div
                      className="
                        mt-2
                        break-all
                        text-[11px]
                        leading-relaxed
                        text-white/25
                      "
                    >
                      {data.executable.path}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={
                      () =>
                        handleOpen(
                          data.executable.path
                        )
                    }
                    className="
                      inline-flex
                      shrink-0
                      items-center
                      gap-2
                      rounded-lg
                      border
                      border-white/[0.09]
                      bg-white/[0.03]
                      px-3
                      py-2
                      text-xs
                      font-medium
                      text-white/50
                      transition
                      hover:bg-white/[0.06]
                      hover:text-white/75
                    "
                  >
                    <FolderOpen
                      className="h-3.5 w-3.5"
                    />

                    Open Location
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="
                  px-4
                  py-5
                  text-sm
                  text-white/30
                "
              >
                A likely primary executable was not identified.
              </div>
            )}
          </Group>


          <Group
            icon={
              MonitorUp
            }
            title="Graphics Technologies"
            description="Detected from technology-specific DLLs and files in the installed game."
          >
            <TechnologyRow
              label="NVIDIA DLSS Super Resolution"
              active={
                data.graphics
                  ?.dlss
              }
              version={
                data.graphics
                  ?.dlssVersion
              }
              detail={
                data.graphics
                  ?.dlssPath
              }
              path={
                data.graphics
                  ?.dlssPath
              }
              onOpen={
                handleOpen
              }
            />

            <TechnologyRow
              label="NVIDIA DLSS Frame Generation"
              active={
                data.graphics
                  ?.dlssFrameGeneration
              }
              version={
                data.graphics
                  ?.dlssFrameGenerationVersion
              }
              detail={
                data.graphics
                  ?.dlssFrameGenerationPath
              }
              path={
                data.graphics
                  ?.dlssFrameGenerationPath
              }
              onOpen={
                handleOpen
              }
            />

            <TechnologyRow
              label="Intel XeSS"
              active={
                data.graphics
                  ?.xess
              }
              version={
                data.graphics
                  ?.xessVersion
              }
              detail={
                data.graphics
                  ?.xessPath
              }
              path={
                data.graphics
                  ?.xessPath
              }
              onOpen={
                handleOpen
              }
            />

            <TechnologyRow
              label="AMD FidelityFX Super Resolution"
              active={
                data.graphics
                  ?.fsr
              }
              version={
                data.graphics
                  ?.fsrVersion
              }
              detail={
                data.graphics
                  ?.fsrPath
              }
              path={
                data.graphics
                  ?.fsrPath
              }
              onOpen={
                handleOpen
              }
            />
          </Group>


          <Group
            icon={
              Sparkles
            }
            title="ReShade"
            description="A ReShade installation is reported only when ReShade.ini is found; generic proxy DLLs alone are not treated as proof."
          >
            <div
              className="
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
                <StatusIcon
                  active={
                    data.reshade
                      ?.installed
                  }
                />

                <div
                  className="
                    min-w-0
                    flex-1
                  "
                >
                  <div
                    className="
                      text-sm
                      font-semibold
                      text-white/70
                    "
                  >
                    {data.reshade
                      ?.installed
                      ? "ReShade detected"
                      : "ReShade not detected"
                    }
                  </div>

                  {data.reshade
                    ?.installed ? (
                    <div
                      className="
                        mt-2
                        space-y-1.5
                        text-xs
                        text-white/35
                      "
                    >
                      <div>
                        Proxy:{" "}
                        <span
                          className="
                            text-white/55
                          "
                        >
                          {data.reshade.proxyDll
                            ?? "Not identified"
                          }
                        </span>
                      </div>

                      <div
                        className="
                          break-all
                        "
                      >
                        INI:{" "}
                        <span
                          className="
                            text-white/55
                          "
                        >
                          {data.reshade.iniPath}
                        </span>
                      </div>

                      {data.reshade
                        .presetPath ? (
                        <div
                          className="
                            break-all
                          "
                        >
                          Preset:{" "}
                          <span
                            className="
                              text-white/55
                            "
                          >
                            {data.reshade.presetPath}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {data.reshade
                  ?.iniPath ? (
                  <button
                    type="button"
                    onClick={
                      () =>
                        handleOpen(
                          data.reshade.iniPath
                        )
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
                      py-1.5
                      text-[11px]
                      text-white/45
                      hover:bg-white/[0.06]
                      hover:text-white/70
                    "
                  >
                    <FolderOpen
                      className="h-3.5 w-3.5"
                    />

                    Open
                  </button>
                ) : null}
              </div>
            </div>
          </Group>


          <Group
            icon={
              Puzzle
            }
            title="Local Mod Manager Evidence"
            description="These checks are intentionally conservative and report local evidence rather than claiming a manager is actively controlling the game."
          >
            <TechnologyRow
              label="Vortex deployment evidence"
              active={
                data.modManagers
                  ?.vortexEvidence
              }
              detail={
                data.modManagers
                  ?.vortexEvidencePath
                  ?? "No Vortex deployment marker was found."
              }
              path={
                data.modManagers
                  ?.vortexEvidencePath
              }
              onOpen={
                handleOpen
              }
            />

            <TechnologyRow
              label="Fluffy Mod Manager evidence"
              active={
                data.modManagers
                  ?.fluffyEvidence
              }
              detail={
                data.modManagers
                  ?.fluffyEvidencePath
                  ?? "No Fluffy/modmanager marker was found."
              }
              path={
                data.modManagers
                  ?.fluffyEvidencePath
              }
              onOpen={
                handleOpen
              }
            />
          </Group>


          {data.scanTruncated ? (
            <div
              className="
                rounded-xl
                border
                border-amber-500/15
                bg-amber-500/[0.045]
                px-4
                py-3
                text-xs
                leading-relaxed
                text-amber-200/60
              "
            >
              The installation contains more than the inspector's
              safety scan limit. Results are based on the first
              portion of the installation that was inspected.
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
