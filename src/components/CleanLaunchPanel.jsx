import {
  Check,
  Gamepad2,
  Layers3,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  launchDefaultProfile,
} from "../services/launchProfiles";

import {
  getCleanLaunchStatus,
  prepareCleanLaunch,
  restoreCleanLaunchApps,
} from "../services/cleanLaunch";


export default function CleanLaunchPanel({
  game,
}) {
  const [
    status,
    setStatus,
  ] =
    useState(null);

  const [
    selected,
    setSelected,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    launching,
    setLaunching,
  ] =
    useState(false);

  const [
    restoring,
    setRestoring,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState(null);

  const [
    error,
    setError,
  ] =
    useState(null);


  async function refresh({
    keepSelection = false,
  } = {}) {
    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const result =
        await getCleanLaunchStatus();

      setStatus(
        result
      );

      setSelected(
        (
          current
        ) => {
          if (keepSelection) {
            const runningIds =
              new Set(
                result.candidates
                  .map(
                    (candidate) =>
                      candidate.id
                  )
              );

            return current
              .filter(
                (id) =>
                  runningIds.has(
                    id
                  )
              );
          }

          return result.candidates
            .filter(
              (candidate) =>
                candidate.selectedByDefault
            )
            .map(
              (candidate) =>
                candidate.id
            );
        }
      );
    } catch (loadError) {
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


  const selectedCount =
    selected.length;

  const hookCandidateCount =
    useMemo(
      () =>
        status?.candidates
          ?.filter(
            (candidate) =>
              candidate.impact
              === "hook-capable"
          )
          .length
        ?? 0,
      [
        status,
      ]
    );


  if (
    !loading
    && status
    && !status.supported
  ) {
    return null;
  }


  function toggle(
    id
  ) {
    setSelected(
      (
        current
      ) =>
        current.includes(
          id
        )
          ? current.filter(
              (value) =>
                value !== id
            )
          : [
              ...current,
              id,
            ]
    );
  }


  async function handleCleanLaunch() {
    setLaunching(
      true
    );

    setMessage(
      null
    );

    setError(
      null
    );

    try {
      const result =
        await prepareCleanLaunch(
          selected
        );

      if (
        result.failures
          ?.length
      ) {
        setMessage(
          result.message
        );
      }

      await launchDefaultProfile(
        game
      );

      const stopped =
        result.stoppedApps
          ?.length
        ?? 0;

      setMessage(
        stopped > 0
          ? `Game launch requested after closing ${stopped} selected background app${stopped === 1 ? "" : "s"}. Restore them from this card when you are finished testing.`
          : "Game launch requested. No selected background apps needed to be closed."
      );

      await refresh({
        keepSelection:
          false,
      });
    } catch (launchError) {
      setError(
        String(
          launchError
        )
      );

      try {
        await restoreCleanLaunchApps();

        setMessage(
          "The game launch failed, so GameAtlas attempted to restore any apps it closed."
        );
      } catch {
        // Preserve the original launch error.
      }

      await refresh({
        keepSelection:
          false,
      });
    } finally {
      setLaunching(
        false
      );
    }
  }


  async function handleRestore() {
    setRestoring(
      true
    );

    setMessage(
      null
    );

    setError(
      null
    );

    try {
      const result =
        await restoreCleanLaunchApps();

      setMessage(
        result.message
      );

      if (
        result.failures
          ?.length
      ) {
        setError(
          result.failures
            .join(
              " • "
            )
        );
      }

      await refresh({
        keepSelection:
          false,
      });
    } catch (restoreError) {
      setError(
        String(
          restoreError
        )
      );
    } finally {
      setRestoring(
        false
      );
    }
  }


  return (
    <div
      className="
        mt-5
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
          gap-3
          border-b
          border-white/[0.06]
          p-4
          sm:flex-row
          sm:items-start
          sm:justify-between
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
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-emerald-500/10
              text-emerald-300
            "
          >
            <ShieldCheck
              className="h-5 w-5"
            />
          </div>

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white/75
              "
            >
              Clean Launch
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
              Temporarily close selected recognized background apps,
              then launch this game's current default Launch Profile.
              GameAtlas keeps a restore list for apps whose executable
              path can be captured.
            </div>

            {status ? (
              <div
                className="
                  mt-2
                  text-xs
                  text-white/30
                "
              >
                {status.candidates.length} recognized running app
                {status.candidates.length === 1 ? "" : "s"}
                {" • "}
                {hookCandidateCount} hook-capable
                {" • "}
                {status.restorableCount} available to restore
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={
            () =>
              refresh()
          }
          disabled={
            loading
            || launching
            || restoring
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
            font-semibold
            text-white/55
            hover:bg-white/[0.07]
            disabled:opacity-40
          "
        >
          <RefreshCw
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

          {status
            ? "Rescan"
            : "Load Options"}
        </button>
      </div>


      {error ? (
        <div
          className="
            border-b
            border-red-500/10
            bg-red-500/[0.04]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-red-200/70
          "
        >
          {error}
        </div>
      ) : null}


      {message ? (
        <div
          className="
            border-b
            border-cyan-500/10
            bg-cyan-500/[0.035]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-cyan-100/60
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
            p-4
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

          Preparing Clean Launch options…
        </div>
      ) : null}


      {status ? (
        <>
          <div
            className="
              border-b
              border-white/[0.06]
              p-4
            "
          >
            <div
              className="
                mb-3
                flex
                flex-col
                gap-1
                sm:flex-row
                sm:items-center
                sm:justify-between
              "
            >
              <div
                className="
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/30
                "
              >
                Apps to temporarily close
              </div>

              <div
                className="
                  text-[10px]
                  text-white/25
                "
              >
                Hook-capable apps are selected by default.
              </div>
            </div>

            {status.candidates.length > 0 ? (
              <div
                className="
                  grid
                  grid-cols-1
                  gap-2
                  md:grid-cols-2
                "
              >
                {status.candidates.map(
                  (
                    candidate
                  ) => {
                    const checked =
                      selected.includes(
                        candidate.id
                      );

                    return (
                      <button
                        key={
                          candidate.id
                        }
                        type="button"
                        onClick={
                          () =>
                            toggle(
                              candidate.id
                            )
                        }
                        disabled={
                          launching
                          || restoring
                        }
                        className={`
                          flex
                          items-start
                          gap-3
                          rounded-lg
                          border
                          px-3
                          py-3
                          text-left
                          transition
                          ${
                            checked
                              ? "border-cyan-400/20 bg-cyan-400/[0.05]"
                              : "border-white/[0.07] bg-black/10 hover:bg-white/[0.035]"
                          }
                          disabled:opacity-40
                        `}
                      >
                        <div
                          className={`
                            mt-0.5
                            flex
                            h-4
                            w-4
                            shrink-0
                            items-center
                            justify-center
                            rounded
                            border
                            ${
                              checked
                                ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-200"
                                : "border-white/15 bg-white/[0.02] text-transparent"
                            }
                          `}
                        >
                          <Check
                            className="h-3 w-3"
                          />
                        </div>

                        <div
                          className="
                            min-w-0
                          "
                        >
                          <div
                            className="
                              text-xs
                              font-semibold
                              text-white/70
                            "
                          >
                            {candidate.name}
                          </div>

                          <div
                            className="
                              mt-1
                              text-[10px]
                              text-white/28
                            "
                          >
                            {candidate.category}
                            {" • "}
                            {candidate.impact === "hook-capable"
                              ? "Hook-capable"
                              : candidate.impact === "monitoring"
                                ? "Monitoring"
                                : "Background"
                            }
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <div
                className="
                  rounded-lg
                  border
                  border-dashed
                  border-white/[0.08]
                  px-3
                  py-4
                  text-xs
                  text-white/30
                "
              >
                No recognized background applications are currently
                running. Clean Launch can still start the game normally.
              </div>
            )}
          </div>


          <div
            className="
              flex
              flex-col
              gap-3
              p-4
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div
              className="
                text-xs
                leading-relaxed
                text-white/28
              "
            >
              Selected: {selectedCount}. GameAtlas never targets
              arbitrary Windows processes; only the recognized
              applications listed above can be closed.
            </div>

            <div
              className="
                flex
                flex-wrap
                gap-2
              "
            >
              {status.sessionActive ? (
                <button
                  type="button"
                  onClick={
                    handleRestore
                  }
                  disabled={
                    restoring
                    || launching
                  }
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    border-violet-400/20
                    bg-violet-400/[0.07]
                    px-3
                    py-2
                    text-xs
                    font-semibold
                    text-violet-100/75
                    hover:bg-violet-400/[0.11]
                    disabled:opacity-40
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

                  Restore Closed Apps
                </button>
              ) : null}

              <button
                type="button"
                onClick={
                  handleCleanLaunch
                }
                disabled={
                  launching
                  || restoring
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  border
                  border-emerald-400/20
                  bg-emerald-400/[0.08]
                  px-4
                  py-2
                  text-xs
                  font-semibold
                  text-emerald-100/80
                  hover:bg-emerald-400/[0.13]
                  disabled:opacity-40
                "
              >
                {launching ? (
                  <Loader2
                    className="
                      h-3.5
                      w-3.5
                      animate-spin
                    "
                  />
                ) : (
                  <Play
                    className="
                      h-3.5
                      w-3.5
                      fill-current
                    "
                  />
                )}

                {launching
                  ? "Preparing…"
                  : "Start Clean Launch"
                }
              </button>
            </div>
          </div>


          <div
            className="
              border-t
              border-white/[0.06]
              px-4
              py-3
              text-[10px]
              leading-relaxed
              text-white/22
            "
          >
            Restoration is manual in this first version because launcher
            protocols do not provide GameAtlas with a reliable game-exit
            signal. Some apps may also restart themselves through their
            own services. Clean Launch is a troubleshooting mode, not a
            permanent Windows configuration change.
          </div>
        </>
      ) : null}
    </div>
  );
}
