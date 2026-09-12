import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Box,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  CircleX,
  RefreshCcw,
  Wrench,
} from "lucide-react";

import {
  getProtonToolboxInfo,
} from "../services/protonToolbox";

import {
  getProtonToolActions,
  launchProtontricksGui,
  launchSteamWinecfg,
  launchWinetricksGui,
  openProtonToolboxPath,
} from "../services/protonTools";

import {
  clearProtonRuntimeOverride,
  setProtonRuntimeOverride,
} from "../services/protonRuntimeOverrides";

import ProtonTroubleshootingPanel from "./ProtonTroubleshootingPanel";
import ProtonToolboxSummary from "./ProtonToolboxSummary";

import {
  createPrefixBackup,
  getPrefixMaintenanceInfo,
  resetPrefix,
  restorePrefixBackup,
} from "../services/protonPrefixMaintenance";

function formatBytes(value) {
  if (
    value === null
    || value === undefined
    || !Number.isFinite(Number(value))
  ) {
    return "Unknown";
  }

  const bytes = Number(value);

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = [
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  let size = bytes;
  let index = -1;

  do {
    size /= 1024;
    index += 1;
  } while (
    size >= 1024
    && index < units.length - 1
  );

  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[index]}`;
}

function StatusRow({
  label,
  value,
  positive = null,
}) {
  return (
    <div
      className="
        flex
        min-w-0
        items-start
        justify-between
        gap-4
        border-b
        border-white/[0.05]
        py-2.5
        last:border-b-0
      "
    >
      <div className="text-xs font-medium text-white/45">
        {label}
      </div>

      <div
        className="
          flex
          min-w-0
          max-w-[65%]
          items-start
          gap-2
          text-right
          text-xs
          text-white/75
        "
      >
        {positive === true ? (
          <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
        ) : null}

        {positive === false ? (
          <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/25" />
        ) : null}

        <span className="break-all">
          {value || "Not detected"}
        </span>
      </div>
    </div>
  );
}

export default function ProtonToolboxPanel({
  game,
}) {
  const [
    state,
    setState,
  ] = useState({
    loading: true,
    error: null,
    data: null,
  });

  const [
    showVersions,
    setShowVersions,
  ] = useState(false);


  const [
    selectedRuntimePath,
    setSelectedRuntimePath,
  ] = useState("");

  const [
    overrideState,
    setOverrideState,
  ] = useState({
    busy: false,
    error: null,
    message: null,
    backupPath: null,
  });


  const [
    maintenanceState,
    setMaintenanceState,
  ] = useState({
    loading: false,
    busy: null,
    error: null,
    message: null,
    data: null,
    safetyBackupPath: null,
  });

  const [
    selectedPrefixBackup,
    setSelectedPrefixBackup,
  ] = useState("");

  const [
    maintenanceConfirmation,
    setMaintenanceConfirmation,
  ] = useState("");


  const [
    actionState,
    setActionState,
  ] = useState({
    loading: true,
    busy: null,
    error: null,
    message: null,
    capabilities: null,
  });

  async function loadActions() {
    try {
      const capabilities =
        await getProtonToolActions();

      setActionState(
        (current) => ({
          ...current,
          loading: false,
          capabilities,
        })
      );
    } catch (error) {
      setActionState(
        (current) => ({
          ...current,
          loading: false,
          error: String(error),
        })
      );
    }
  }

  async function runAction(
    id,
    action,
    successMessage
  ) {
    setActionState(
      (current) => ({
        ...current,
        busy: id,
        error: null,
        message: null,
      })
    );

    try {
      await action();

      setActionState(
        (current) => ({
          ...current,
          busy: null,
          message: successMessage,
        })
      );
    } catch (error) {
      setActionState(
        (current) => ({
          ...current,
          busy: null,
          error: String(error),
        })
      );
    }
  }

  async function refreshPrefixMaintenance(
    prefixPath =
      state.data?.prefix?.prefixPath
  ) {
    if (!prefixPath) {
      setMaintenanceState(
        (current) => ({
          ...current,
          loading: false,
          data: null,
        })
      );
      return;
    }

    setMaintenanceState(
      (current) => ({
        ...current,
        loading: true,
        error: null,
      })
    );

    try {
      const data =
        await getPrefixMaintenanceInfo(
          game,
          prefixPath
        );

      setMaintenanceState(
        (current) => ({
          ...current,
          loading: false,
          data,
        })
      );

      if (
        selectedPrefixBackup
        && !data.backups.some(
          (backup) =>
            backup.path
            === selectedPrefixBackup
        )
      ) {
        setSelectedPrefixBackup(
          ""
        );
      }
    } catch (error) {
      setMaintenanceState(
        (current) => ({
          ...current,
          loading: false,
          error: String(error),
        })
      );
    }
  }


  async function runPrefixMaintenance(
    id,
    action
  ) {
    setMaintenanceState(
      (current) => ({
        ...current,
        busy: id,
        error: null,
        message: null,
        safetyBackupPath: null,
      })
    );

    try {
      const result =
        await action();

      setMaintenanceState(
        (current) => ({
          ...current,
          busy: null,
          message:
            result?.message
            ?? "Prefix action completed.",
          safetyBackupPath:
            result?.safetyBackupPath
            ?? result?.backupPath
            ?? null,
        })
      );

      setMaintenanceConfirmation(
        ""
      );

      await refresh();
      await refreshPrefixMaintenance();
    } catch (error) {
      setMaintenanceState(
        (current) => ({
          ...current,
          busy: null,
          error: String(error),
        })
      );
    }
  }


  async function useRuntimeFromHistory(
    runtime
  ) {
    if (!runtime?.name) {
      throw new Error(
        "No runtime was selected."
      );
    }

    const installedRuntime =
      installedVersions.find(
        (item) =>
          item.name
          === runtime.name
          || (
            runtime.path
            && item.path
              === runtime.path
          )
      );

    if (!installedRuntime) {
      throw new Error(
        `${runtime.name} is no longer installed.`
      );
    }

    await setProtonRuntimeOverride(
      game,
      installedRuntime
    );

    setSelectedRuntimePath(
      installedRuntime.path
    );

    await refresh();
  }


  async function revertToLastKnownWorking(
    runtime
  ) {
    if (
      !runtime?.name
    ) {
      throw new Error(
        "No saved runtime is available."
      );
    }

    const installedRuntime =
      installedVersions.find(
        (item) =>
          item.name
          === runtime.name
          || (
            runtime.path
            && item.path
              === runtime.path
          )
      );

    if (!installedRuntime) {
      throw new Error(
        `${runtime.name} is no longer installed.`
      );
    }

    await setProtonRuntimeOverride(
      game,
      installedRuntime
    );

    setSelectedRuntimePath(
      installedRuntime.path
    );

    await refresh();
  }


  async function applyRuntimeOverride() {
    const runtime =
      installedVersions.find(
        (item) =>
          item.path
          === selectedRuntimePath
      );

    if (!runtime) {
      setOverrideState({
        busy: false,
        error:
          "Select an installed compatibility tool first.",
        message: null,
        backupPath: null,
      });
      return;
    }

    setOverrideState({
      busy: true,
      error: null,
      message: null,
      backupPath: null,
    });

    try {
      const result =
        await setProtonRuntimeOverride(
          game,
          runtime
        );

      setOverrideState({
        busy: false,
        error: null,
        message:
          result?.message
          ?? "Runtime override updated.",
        backupPath:
          result?.backupPath
          ?? null,
      });

      await refresh();
    } catch (error) {
      setOverrideState({
        busy: false,
        error: String(error),
        message: null,
        backupPath: null,
      });
    }
  }


  async function clearRuntimeOverride() {
    setOverrideState({
      busy: true,
      error: null,
      message: null,
      backupPath: null,
    });

    try {
      const result =
        await clearProtonRuntimeOverride(
          game
        );

      setOverrideState({
        busy: false,
        error: null,
        message:
          result?.message
          ?? "Runtime override cleared.",
        backupPath:
          result?.backupPath
          ?? null,
      });

      setSelectedRuntimePath(
        ""
      );

      await refresh();
    } catch (error) {
      setOverrideState({
        busy: false,
        error: String(error),
        message: null,
        backupPath: null,
      });
    }
  }


  async function refresh() {
    setState({
      loading: true,
      error: null,
      data: null,
    });

    try {
      const data =
        await getProtonToolboxInfo(
          game
        );

      setState({
        loading: false,
        error: null,
        data,
      });
    } catch (error) {
      setState({
        loading: false,
        error: String(error),
        data: null,
      });
    }
  }

  useEffect(
    () => {
      refresh();
    },
    [
      game?.id,
      game?.launcherId,
      game?.store,
    ]
  );


  useEffect(
    () => {
      loadActions();
    },
    []
  );


  useEffect(
    () => {
      setSelectedRuntimePath(
        ""
      );

      setOverrideState({
        busy: false,
        error: null,
        message: null,
        backupPath: null,
      });
    },
    [
      game?.id,
    ]
  );


  useEffect(
    () => {
      setSelectedPrefixBackup(
        ""
      );

      setMaintenanceConfirmation(
        ""
      );

      setMaintenanceState({
        loading: false,
        busy: null,
        error: null,
        message: null,
        data: null,
        safetyBackupPath: null,
      });
    },
    [
      game?.id,
    ]
  );


  useEffect(
    () => {
      if (
        state.data?.prefix?.prefixPath
      ) {
        refreshPrefixMaintenance(
          state.data.prefix.prefixPath
        );
      }
    },
    [
      state.data?.prefix?.prefixPath,
    ]
  );

  const installedVersions =
    state.data
      ?.installedProtonVersions
      ?? [];

  const prefixPath =
    state.data
      ?.prefix
      ?.prefixPath
    ?? null;

  const prefixMaintenance =
    maintenanceState.data;

  const prefixHealth =
    prefixMaintenance?.health
    ?? null;

  const prefixBackups =
    prefixMaintenance?.backups
    ?? [];

  const formatBytes = (
    bytes
  ) => {
    if (
      !Number.isFinite(
        Number(bytes)
      )
      || Number(bytes) <= 0
    ) {
      return "0 B";
    }

    const units = [
      "B",
      "KB",
      "MB",
      "GB",
      "TB",
    ];

    let value =
      Number(bytes);

    let index =
      0;

    while (
      value >= 1024
      && index < units.length - 1
    ) {
      value /= 1024;
      index += 1;
    }

    return `${value.toFixed(
      index === 0
        ? 0
        : 1
    )} ${units[index]}`;
  };

  const geCount =
    useMemo(
      () =>
        installedVersions.filter(
          (item) =>
            item.isGeProton
        ).length,
      [
        installedVersions,
      ]
    );

  if (
    !state.loading
    && state.data
    && !state.data.supported
  ) {
    return (
      <div
        className="
          rounded-xl
          border
          border-white/[0.07]
          bg-white/[0.02]
          px-4
          py-3
          text-xs
          text-white/40
        "
      >
        Proton Toolbox is available on Linux.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className="
          flex
          items-center
          justify-between
          gap-3
          rounded-xl
          border
          border-cyan-500/15
          bg-cyan-500/[0.04]
          px-4
          py-3
        "
      >
        <div className="flex min-w-0 items-center gap-3">
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
            <Wrench className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-white/85">
              Proton environment
            </div>

            <div className="mt-0.5 text-[11px] text-white/35">
              Prefix discovery, active runtime, and installed compatibility tools
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={
            refresh
          }
          disabled={
            state.loading
          }
          className="
            flex
            h-8
            w-8
            items-center
            justify-center
            rounded-lg
            border
            border-white/[0.08]
            bg-white/[0.025]
            text-white/40
            transition
            hover:bg-white/[0.06]
            hover:text-white/75
            disabled:opacity-40
          "
          title="Refresh Proton information"
        >
          <RefreshCcw
            className={`
              h-3.5
              w-3.5
              ${
                state.loading
                  ? "animate-spin"
                  : ""
              }
            `}
          />
        </button>
      </div>

      {state.error ? (
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
            text-red-200/75
          "
        >
          {state.error}
        </div>
      ) : null}

      {state.loading ? (
        <div
          className="
            rounded-xl
            border
            border-white/[0.07]
            bg-white/[0.02]
            px-4
            py-4
            text-xs
            text-white/35
          "
        >
          Inspecting Proton environment…
        </div>
      ) : null}

      {!state.loading
      && state.data ? (
        <>
          <div
            className="
              rounded-xl
              border
              border-white/[0.07]
              bg-white/[0.02]
              px-4
              py-1
            "
          >
            <StatusRow
              label="Launcher"
              value={
                state.data.launcherSource
              }
              positive={
                Boolean(
                  state.data.launcherSource
                )
              }
            />

            {state.data.steamAppId ? (
              <StatusRow
                label="Steam App ID"
                value={
                  state.data.steamAppId
                }
                positive
              />
            ) : null}

            <StatusRow
              label="Runtime in use"
              value={
                state.data.runtimeInUse?.name
              }
              positive={
                Boolean(
                  state.data.runtimeInUse?.name
                )
              }
            />

            {state.data.runtimeInUse ? (
              <>
                <StatusRow
                  label="Runtime type"
                  value={
                    state.data.runtimeInUse.kind
                  }
                />

                <StatusRow
                  label="Runtime source"
                  value={
                    state.data.runtimeInUse.source
                  }
                />

                <StatusRow
                  label="Match confidence"
                  value={
                    state.data.runtimeInUse.confidence
                  }
                />

                <StatusRow
                  label="Matched by"
                  value={
                    state.data.runtimeInUse.matchedBy
                  }
                />

                {state.data.runtimeInUse.configPath ? (
                  <StatusRow
                    label="Runtime config"
                    value={
                      state.data.runtimeInUse.configPath
                    }
                  />
                ) : null}
              </>
            ) : null}

            <StatusRow
              label="Compatibility prefix"
              value={
                state.data.prefix?.exists
                  ? "Detected"
                  : "Not detected"
              }
              positive={
                Boolean(
                  state.data.prefix?.exists
                )
              }
            />

            <StatusRow
              label="Prefix size"
              value={
                state.data.prefix?.exists
                  ? formatBytes(
                      state.data.prefix
                        ?.sizeBytes
                    )
                  : null
              }
            />

            {state.data.prefix?.source ? (
              <StatusRow
                label="Prefix source"
                value={
                  state.data.prefix.source
                }
              />
            ) : null}

            {state.data.prefix?.compatdataPath ? (
              <StatusRow
                label="Compatdata"
                value={
                  state.data.prefix
                    ?.compatdataPath
                }
              />
            ) : null}

            <StatusRow
              label="Prefix path"
              value={
                state.data.prefix
                  ?.prefixPath
              }
            />

            <StatusRow
              label="drive_c"
              value={
                state.data.prefix
                  ?.driveCPath
              }
            />
          </div>

          <div
            className="
              rounded-xl
              border
              border-white/[0.07]
              bg-white/[0.02]
              px-4
              py-3
            "
          >
            <div className="text-xs font-semibold text-white/75">
              Safe actions
            </div>

            <div className="mt-1 text-[11px] text-white/30">
              Open detected paths and launch compatibility utilities without modifying the prefix automatically.
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
                disabled={
                  !state.data.prefix?.prefixPath
                  || actionState.busy
                }
                onClick={
                  () =>
                    runAction(
                      "prefix",
                      () =>
                        openProtonToolboxPath(
                          state.data.prefix.prefixPath
                        ),
                      "Opened the compatibility prefix."
                    )
                }
                className="
                  rounded-lg
                  border
                  border-white/[0.09]
                  bg-white/[0.03]
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-white/65
                  transition
                  hover:bg-white/[0.07]
                  hover:text-white/90
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                "
              >
                Open Prefix
              </button>

              <button
                type="button"
                disabled={
                  !state.data.prefix?.driveCPath
                  || actionState.busy
                }
                onClick={
                  () =>
                    runAction(
                      "drive-c",
                      () =>
                        openProtonToolboxPath(
                          state.data.prefix.driveCPath
                        ),
                      "Opened drive_c."
                    )
                }
                className="
                  rounded-lg
                  border
                  border-white/[0.09]
                  bg-white/[0.03]
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-white/65
                  transition
                  hover:bg-white/[0.07]
                  hover:text-white/90
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                "
              >
                Open drive_c
              </button>

              <button
                type="button"
                disabled={
                  !state.data.runtimeInUse?.configPath
                  || actionState.busy
                }
                onClick={
                  () =>
                    runAction(
                      "config",
                      () =>
                        openProtonToolboxPath(
                          state.data.runtimeInUse.configPath
                        ),
                      "Opened the runtime configuration."
                    )
                }
                className="
                  rounded-lg
                  border
                  border-white/[0.09]
                  bg-white/[0.03]
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-white/65
                  transition
                  hover:bg-white/[0.07]
                  hover:text-white/90
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                "
              >
                Open Runtime Config
              </button>

              {state.data.steamAppId ? (
                <button
                  type="button"
                  disabled={
                    !actionState.capabilities
                      ?.protontricksAvailable
                    || actionState.busy
                  }
                  onClick={
                    () =>
                      runAction(
                        "winecfg",
                        () =>
                          launchSteamWinecfg(
                            state.data.steamAppId
                          ),
                        "Launched Wine configuration through Protontricks."
                      )
                  }
                  className="
                    rounded-lg
                    border
                    border-cyan-400/15
                    bg-cyan-400/[0.04]
                    px-3
                    py-2
                    text-xs
                    font-medium
                    text-cyan-100/65
                    transition
                    hover:bg-cyan-400/[0.08]
                    hover:text-cyan-50
                    disabled:cursor-not-allowed
                    disabled:opacity-30
                  "
                >
                  Wine Configuration
                </button>
              ) : null}

              <button
                type="button"
                disabled={
                  !actionState.capabilities
                    ?.protontricksAvailable
                  || actionState.busy
                }
                onClick={
                  () =>
                    runAction(
                      "protontricks",
                      launchProtontricksGui,
                      "Launched Protontricks."
                    )
                }
                className="
                  rounded-lg
                  border
                  border-violet-400/15
                  bg-violet-400/[0.04]
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-violet-100/65
                  transition
                  hover:bg-violet-400/[0.08]
                  hover:text-violet-50
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                "
              >
                Protontricks
              </button>

              {!state.data.steamAppId
              && state.data.prefix?.prefixPath ? (
                <button
                  type="button"
                  disabled={
                    !actionState.capabilities
                      ?.winetricksAvailable
                    || actionState.busy
                  }
                  onClick={
                    () =>
                      runAction(
                        "winetricks",
                        () =>
                          launchWinetricksGui(
                            state.data.prefix.prefixPath
                          ),
                        "Launched Winetricks for this prefix."
                      )
                  }
                  className="
                    rounded-lg
                    border
                    border-amber-400/15
                    bg-amber-400/[0.04]
                    px-3
                    py-2
                    text-xs
                    font-medium
                    text-amber-100/65
                    transition
                    hover:bg-amber-400/[0.08]
                    hover:text-amber-50
                    disabled:cursor-not-allowed
                    disabled:opacity-30
                  "
                >
                  Winetricks
                </button>
              ) : null}
            </div>

            {actionState.capabilities ? (
              <div className="mt-2 text-[10px] text-white/25">
                Protontricks: {
                  actionState.capabilities
                    .protontricksAvailable
                    ? "available"
                    : "not detected"
                }
                {" • "}
                Winetricks: {
                  actionState.capabilities
                    .winetricksAvailable
                    ? "available"
                    : "not detected"
                }
              </div>
            ) : null}

            {actionState.error ? (
              <div
                className="
                  mt-3
                  rounded-lg
                  border
                  border-red-500/15
                  bg-red-500/[0.04]
                  px-3
                  py-2
                  text-xs
                  text-red-200/70
                "
              >
                {actionState.error}
              </div>
            ) : null}

            {actionState.message ? (
              <div
                className="
                  mt-3
                  rounded-lg
                  border
                  border-emerald-500/15
                  bg-emerald-500/[0.04]
                  px-3
                  py-2
                  text-xs
                  text-emerald-200/65
                "
              >
                {actionState.message}
              </div>
            ) : null}
          </div>


          <div
            className="
              rounded-xl
              border
              border-cyan-400/15
              bg-cyan-400/[0.025]
              px-4
              py-3
            "
          >
            <div
              className="
                flex
                flex-wrap
                items-start
                justify-between
                gap-3
              "
            >
              <div>
                <ProtonToolboxSummary
            game={
              game
            }
            toolbox={
              state.data
            }
            onUseRuntime={
              useRuntimeFromHistory
            }
          />


          <ProtonTroubleshootingPanel
            game={
              game
            }
            toolbox={
              state.data
            }
            onRefresh={
              refresh
            }
            onRevertRuntime={
              revertToLastKnownWorking
            }
          />


          <div className="text-xs font-semibold text-white/80">
                  Prefix maintenance
                </div>

                <div className="mt-1 text-[11px] leading-relaxed text-white/30">
                  Health checks, backups, restore, and guarded reset for this Wine/Proton prefix.
                </div>
              </div>

              <button
                type="button"
                disabled={
                  !prefixPath
                  || maintenanceState.loading
                  || maintenanceState.busy
                }
                onClick={
                  () =>
                    refreshPrefixMaintenance()
                }
                className="
                  rounded-lg
                  border
                  border-white/[0.09]
                  bg-white/[0.025]
                  px-3
                  py-1.5
                  text-[11px]
                  font-medium
                  text-white/55
                  transition
                  hover:bg-white/[0.06]
                  hover:text-white/80
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                "
              >
                Refresh Health
              </button>
            </div>

            {prefixHealth ? (
              <div
                className="
                  mt-3
                  grid
                  grid-cols-2
                  gap-2
                  xl:grid-cols-4
                "
              >
                <div className="rounded-lg border border-white/[0.06] bg-black/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-white/25">
                    Health
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white/70">
                    {prefixHealth.health}
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-black/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-white/25">
                    Size
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white/70">
                    {formatBytes(
                      prefixHealth.sizeBytes
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-black/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-white/25">
                    Architecture
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white/70">
                    {prefixHealth.architecture
                      ?? "Unknown"}
                  </div>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-black/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-white/25">
                    Backups
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white/70">
                    {prefixBackups.length}
                  </div>
                </div>
              </div>
            ) : null}

            {prefixHealth?.issues?.length ? (
              <div
                className="
                  mt-3
                  rounded-lg
                  border
                  border-amber-400/15
                  bg-amber-400/[0.04]
                  px-3
                  py-2
                "
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-100/50">
                  Health findings
                </div>

                <div className="mt-1 space-y-1 text-[11px] text-amber-100/60">
                  {prefixHealth.issues.map(
                    (issue) => (
                      <div
                        key={
                          issue
                        }
                      >
                        • {issue}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}

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
                disabled={
                  !prefixPath
                  || maintenanceState.busy
                  || !prefixHealth?.exists
                }
                onClick={
                  () =>
                    runPrefixMaintenance(
                      "backup",
                      () =>
                        createPrefixBackup(
                          game,
                          prefixPath
                        )
                    )
                }
                className="
                  rounded-lg
                  border
                  border-cyan-400/15
                  bg-cyan-400/[0.05]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-cyan-100/70
                  transition
                  hover:bg-cyan-400/[0.1]
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                "
              >
                Back Up Prefix
              </button>
            </div>

            <div
              className="
                mt-3
                grid
                grid-cols-1
                gap-2
                xl:grid-cols-[minmax(0,1fr)_auto]
              "
            >
              <select
                value={
                  selectedPrefixBackup
                }
                onChange={
                  (event) =>
                    setSelectedPrefixBackup(
                      event.target.value
                    )
                }
                disabled={
                  maintenanceState.busy
                  || prefixBackups.length
                    === 0
                }
                className="
                  min-w-0
                  rounded-lg
                  border
                  border-white/[0.09]
                  bg-[#111722]
                  px-3
                  py-2
                  text-xs
                  text-white/75
                  outline-none
                  disabled:cursor-not-allowed
                  disabled:opacity-35
                "
              >
                <option value="">
                  Select prefix backup…
                </option>

                {prefixBackups.map(
                  (backup) => (
                    <option
                      key={
                        backup.path
                      }
                      value={
                        backup.path
                      }
                    >
                      {backup.id} — {formatBytes(
                        backup.sizeBytes
                      )}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                disabled={
                  !prefixPath
                  || !selectedPrefixBackup
                  || maintenanceState.busy
                  || maintenanceConfirmation
                    !== "RESTORE"
                }
                onClick={
                  () =>
                    runPrefixMaintenance(
                      "restore",
                      () =>
                        restorePrefixBackup(
                          game,
                          prefixPath,
                          selectedPrefixBackup,
                          maintenanceConfirmation
                        )
                    )
                }
                className="
                  rounded-lg
                  border
                  border-emerald-400/15
                  bg-emerald-400/[0.05]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-emerald-100/70
                  transition
                  hover:bg-emerald-400/[0.1]
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                "
              >
                Restore Backup
              </button>
            </div>

            <div
              className="
                mt-3
                rounded-lg
                border
                border-red-400/15
                bg-red-400/[0.025]
                p-3
              "
            >
              <div className="text-[11px] font-semibold text-red-100/65">
                Destructive actions
              </div>

              <div className="mt-1 text-[10px] leading-relaxed text-white/30">
                Restore replaces the current prefix after making a safety backup. Reset backs up the current prefix, removes it, and recreates an empty prefix for the launcher to rebuild.
              </div>

              <div
                className="
                  mt-3
                  grid
                  grid-cols-1
                  gap-2
                  xl:grid-cols-[minmax(0,1fr)_auto]
                "
              >
                <input
                  value={
                    maintenanceConfirmation
                  }
                  onChange={
                    (event) =>
                      setMaintenanceConfirmation(
                        event.target.value
                      )
                  }
                  placeholder='Type RESTORE or RESET'
                  className="
                    min-w-0
                    rounded-lg
                    border
                    border-white/[0.09]
                    bg-[#111722]
                    px-3
                    py-2
                    text-xs
                    text-white/75
                    outline-none
                    placeholder:text-white/20
                    focus:border-red-400/30
                  "
                />

                <button
                  type="button"
                  disabled={
                    !prefixPath
                    || maintenanceState.busy
                    || !prefixHealth?.exists
                    || maintenanceConfirmation
                      !== "RESET"
                  }
                  onClick={
                    () =>
                      runPrefixMaintenance(
                        "reset",
                        () =>
                          resetPrefix(
                            game,
                            prefixPath,
                            maintenanceConfirmation
                          )
                      )
                  }
                  className="
                    rounded-lg
                    border
                    border-red-400/20
                    bg-red-400/[0.06]
                    px-3
                    py-2
                    text-xs
                    font-semibold
                    text-red-100/70
                    transition
                    hover:bg-red-400/[0.12]
                    disabled:cursor-not-allowed
                    disabled:opacity-30
                  "
                >
                  Reset Prefix
                </button>
              </div>
            </div>

            {maintenanceState.error ? (
              <div
                className="
                  mt-3
                  rounded-lg
                  border
                  border-red-500/15
                  bg-red-500/[0.04]
                  px-3
                  py-2
                  text-xs
                  leading-relaxed
                  text-red-200/70
                "
              >
                {maintenanceState.error}
              </div>
            ) : null}

            {maintenanceState.message ? (
              <div
                className="
                  mt-3
                  rounded-lg
                  border
                  border-emerald-500/15
                  bg-emerald-500/[0.04]
                  px-3
                  py-2
                  text-xs
                  leading-relaxed
                  text-emerald-200/70
                "
              >
                <div>
                  {maintenanceState.message}
                </div>

                {maintenanceState.safetyBackupPath ? (
                  <div className="mt-1 break-all text-[10px] text-white/30">
                    Backup: {maintenanceState.safetyBackupPath}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>


          <div
            className="
              rounded-xl
              border
              border-violet-400/15
              bg-violet-400/[0.035]
              px-4
              py-3
            "
          >
            <div className="text-xs font-semibold text-white/80">
              Runtime override
            </div>

            <div className="mt-1 text-[11px] leading-relaxed text-white/30">
              Set or clear the per-game compatibility runtime. GameAtlas creates a backup of the launcher configuration before every change.
            </div>

            <div
              className="
                mt-3
                grid
                grid-cols-1
                gap-2
                xl:grid-cols-[minmax(0,1fr)_auto_auto]
              "
            >
              <select
                value={
                  selectedRuntimePath
                }
                onChange={
                  (event) =>
                    setSelectedRuntimePath(
                      event.target.value
                    )
                }
                disabled={
                  overrideState.busy
                  || installedVersions.length
                    === 0
                }
                className="
                  min-w-0
                  rounded-lg
                  border
                  border-white/[0.09]
                  bg-[#111722]
                  px-3
                  py-2
                  text-xs
                  text-white/75
                  outline-none
                  transition
                  focus:border-violet-400/35
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                <option value="">
                  Select installed runtime…
                </option>

                {installedVersions.map(
                  (item) => (
                    <option
                      key={
                        item.path
                      }
                      value={
                        item.path
                      }
                    >
                      {item.name} — {item.source}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                onClick={
                  applyRuntimeOverride
                }
                disabled={
                  overrideState.busy
                  || !selectedRuntimePath
                }
                className="
                  rounded-lg
                  border
                  border-violet-400/20
                  bg-violet-400/[0.07]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-violet-100/75
                  transition
                  hover:bg-violet-400/[0.12]
                  hover:text-violet-50
                  disabled:cursor-not-allowed
                  disabled:opacity-35
                "
              >
                Apply Override
              </button>

              <button
                type="button"
                onClick={
                  clearRuntimeOverride
                }
                disabled={
                  overrideState.busy
                }
                className="
                  rounded-lg
                  border
                  border-white/[0.09]
                  bg-white/[0.025]
                  px-3
                  py-2
                  text-xs
                  font-medium
                  text-white/55
                  transition
                  hover:bg-white/[0.06]
                  hover:text-white/80
                  disabled:cursor-not-allowed
                  disabled:opacity-35
                "
              >
                Clear Override
              </button>
            </div>

            <div className="mt-2 text-[10px] leading-relaxed text-white/25">
              Steam updates CompatToolMapping. Heroic updates the matched game Wine/Proton setting. Lutris updates wine.version.
            </div>

            {overrideState.error ? (
              <div
                className="
                  mt-3
                  rounded-lg
                  border
                  border-red-500/15
                  bg-red-500/[0.04]
                  px-3
                  py-2
                  text-xs
                  leading-relaxed
                  text-red-200/70
                "
              >
                {overrideState.error}
              </div>
            ) : null}

            {overrideState.message ? (
              <div
                className="
                  mt-3
                  rounded-lg
                  border
                  border-emerald-500/15
                  bg-emerald-500/[0.04]
                  px-3
                  py-2
                  text-xs
                  leading-relaxed
                  text-emerald-200/70
                "
              >
                <div>
                  {overrideState.message}
                </div>

                {overrideState.backupPath ? (
                  <div className="mt-1 break-all text-[10px] text-white/30">
                    Backup: {overrideState.backupPath}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>


          <div
            className="
              rounded-xl
              border
              border-white/[0.07]
              bg-white/[0.02]
            "
          >
            <button
              type="button"
              onClick={
                () =>
                  setShowVersions(
                    (current) =>
                      !current
                  )
              }
              className="
                flex
                w-full
                items-center
                justify-between
                gap-4
                px-4
                py-3
                text-left
              "
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
                  <Box className="h-3.5 w-3.5 text-cyan-300/75" />
                  Installed compatibility tools
                </div>

                <div className="mt-1 text-[11px] text-white/30">
                  {installedVersions.length} detected
                  {geCount > 0
                    ? ` • ${geCount} GE-Proton`
                    : ""}
                </div>
              </div>

              {showVersions ? (
                <ChevronUp className="h-4 w-4 text-white/30" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/30" />
              )}
            </button>

            {showVersions ? (
              <div className="border-t border-white/[0.06] px-4 py-3">
                {installedVersions.length ===
                0 ? (
                  <div className="text-xs text-white/35">
                    No Proton/Wine compatibility tools were detected.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {installedVersions.map(
                      (item) => (
                        <div
                          key={
                            item.path
                          }
                          className="
                            rounded-lg
                            border
                            border-white/[0.06]
                            bg-black/10
                            px-3
                            py-2.5
                          "
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-medium text-white/75">
                              {item.name}
                            </div>

                            {item.isGeProton ? (
                              <span
                                className="
                                  rounded-full
                                  border
                                  border-violet-400/20
                                  bg-violet-400/[0.06]
                                  px-2
                                  py-0.5
                                  text-[10px]
                                  font-semibold
                                  text-violet-200/70
                                "
                              >
                                GE-Proton
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 break-all text-[10px] text-white/25">
                            {item.path}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {state.data.notes
            ?.length ? (
            <div
              className="
                rounded-xl
                border
                border-amber-500/15
                bg-amber-500/[0.035]
                px-4
                py-3
              "
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/55">
                Notes
              </div>

              <div className="mt-2 space-y-1.5">
                {state.data.notes.map(
                  (note) => (
                    <div
                      key={
                        note
                      }
                      className="text-xs leading-relaxed text-amber-100/55"
                    >
                      {note}
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
