import {
  useEffect,
  useState,
} from "react";

import {
  openProtonToolboxPath,
} from "../services/protonTools";

import {
  getProtonTroubleshootingInfo,
  saveLastKnownWorkingRuntime,
} from "../services/protonTroubleshooting";


function statusClasses(
  status
) {
  switch (
    status
  ) {
    case "ok":
      return "border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-100/70";

    case "error":
      return "border-red-400/15 bg-red-400/[0.04] text-red-100/70";

    case "warning":
      return "border-amber-400/15 bg-amber-400/[0.04] text-amber-100/70";

    default:
      return "border-white/[0.07] bg-white/[0.02] text-white/55";
  }
}


export default function ProtonTroubleshootingPanel({
  game,
  toolbox,
  onRefresh,
  onRevertRuntime,
}) {
  const [
    state,
    setState,
  ] = useState({
    loading: false,
    busy: null,
    error: null,
    message: null,
    data: null,
  });


  async function refresh() {
    setState(
      (current) => ({
        ...current,
        loading: true,
        error: null,
      })
    );

    try {
      const data =
        await getProtonTroubleshootingInfo(
          game,
          toolbox
        );

      setState(
        (current) => ({
          ...current,
          loading: false,
          data,
        })
      );
    } catch (error) {
      setState(
        (current) => ({
          ...current,
          loading: false,
          error: String(error),
        })
      );
    }
  }


  useEffect(
    () => {
      refresh();
    },
    [
      game?.id,
      toolbox?.prefix?.prefixPath,
      toolbox?.runtimeInUse?.name,
      toolbox?.runtimeInUse?.path,
      toolbox?.runtimeInUse?.source,
    ]
  );


  async function markWorking() {
    setState(
      (current) => ({
        ...current,
        busy: "working",
        error: null,
        message: null,
      })
    );

    try {
      const result =
        await saveLastKnownWorkingRuntime(
          game,
          toolbox
        );

      setState(
        (current) => ({
          ...current,
          busy: null,
          message:
            `${result.name} saved as the last known working runtime.`,
        })
      );

      await refresh();
    } catch (error) {
      setState(
        (current) => ({
          ...current,
          busy: null,
          error: String(error),
        })
      );
    }
  }


  const data =
    state.data;

  const lastWorking =
    data
      ?.lastKnownWorkingRuntime
    ?? null;

  const activeRuntime =
    toolbox
      ?.runtimeInUse
      ?.name
    ?? null;

  const canMarkWorking =
    activeRuntime
    && activeRuntime
      !== "Steam automatic/default";

  return (
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
          <div className="text-xs font-semibold text-white/80">
            Proton troubleshooting
          </div>

          <div className="mt-1 text-[11px] leading-relaxed text-white/30">
            Diagnose prefix, runtime, override, and logging problems before changing anything.
          </div>
        </div>

        <button
          type="button"
          onClick={
            refresh
          }
          disabled={
            state.loading
            || state.busy
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
          Refresh Diagnostics
        </button>
      </div>

      {data ? (
        <>
          <div
            className={
              `mt-3 rounded-lg border px-3 py-2 ${
                data.overallStatus
                  === "healthy"
                  ? "border-emerald-400/15 bg-emerald-400/[0.04]"
                  : data.overallStatus
                    === "needs-attention"
                    ? "border-red-400/15 bg-red-400/[0.04]"
                    : "border-amber-400/15 bg-amber-400/[0.04]"
              }`
            }
          >
            <div className="text-[10px] uppercase tracking-wide text-white/30">
              Troubleshooting status
            </div>

            <div className="mt-1 text-xs font-semibold text-white/75">
              {data.overallStatus}
            </div>

            <div className="mt-1 text-[11px] leading-relaxed text-white/45">
              {data.summary}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {data.checks.map(
              (check) => (
                <div
                  key={
                    check.id
                  }
                  className={
                    `rounded-lg border px-3 py-2 ${statusClasses(
                      check.status
                    )}`
                  }
                >
                  <div className="text-[11px] font-semibold">
                    {check.title}
                  </div>

                  <div className="mt-1 text-[10px] leading-relaxed opacity-80">
                    {check.message}
                  </div>
                </div>
              )
            )}
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
                !canMarkWorking
                || state.busy
              }
              onClick={
                markWorking
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
              Mark Current Runtime Working
            </button>

            {data.protonLog?.path ? (
              <button
                type="button"
                disabled={
                  state.busy
                }
                onClick={
                  () =>
                    openProtonToolboxPath(
                      data.protonLog.path
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
                  disabled:opacity-30
                "
              >
                Open Proton Log
              </button>
            ) : null}

            {lastWorking
            && lastWorking.name
              !== activeRuntime
            && typeof onRevertRuntime
              === "function" ? (
              <button
                type="button"
                disabled={
                  state.busy
                }
                onClick={
                  async () => {
                    setState(
                      (current) => ({
                        ...current,
                        busy: "revert",
                        error: null,
                        message: null,
                      })
                    );

                    try {
                      await onRevertRuntime(
                        lastWorking
                      );

                      setState(
                        (current) => ({
                          ...current,
                          busy: null,
                          message:
                            `Reverted to ${lastWorking.name}.`,
                        })
                      );

                      if (
                        typeof onRefresh
                        === "function"
                      ) {
                        await onRefresh();
                      }

                      await refresh();
                    } catch (error) {
                      setState(
                        (current) => ({
                          ...current,
                          busy: null,
                          error: String(error),
                        })
                      );
                    }
                  }
                }
                className="
                  rounded-lg
                  border
                  border-violet-400/15
                  bg-violet-400/[0.05]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-violet-100/70
                  transition
                  hover:bg-violet-400/[0.1]
                  disabled:opacity-30
                "
              >
                Revert to Last Known Working
              </button>
            ) : null}
          </div>

          {lastWorking ? (
            <div className="mt-3 text-[10px] leading-relaxed text-white/25">
              Last known working: {lastWorking.name} ({lastWorking.launcher})
            </div>
          ) : null}
        </>
      ) : null}

      {state.error ? (
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
          {state.error}
        </div>
      ) : null}

      {state.message ? (
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
            text-emerald-200/70
          "
        >
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
