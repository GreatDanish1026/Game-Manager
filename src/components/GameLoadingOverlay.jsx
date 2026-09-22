import {
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";


function statusFor({
  loading,
  loaded,
  error,
}) {
  if (loading) {
    return "loading";
  }

  if (error) {
    return "error";
  }

  if (loaded) {
    return "complete";
  }

  return "waiting";
}


function statusLabel(
  status
) {
  if (status === "complete") {
    return "Complete";
  }

  if (status === "error") {
    return "Could not load";
  }

  if (status === "loading") {
    return "Loading";
  }

  return "Waiting";
}


function statusSymbol(
  status
) {
  if (status === "complete") {
    return "✓";
  }

  if (status === "error") {
    return "!";
  }

  if (status === "loading") {
    return "●";
  }

  return "○";
}


export default function GameLoadingOverlay({
  game,
}) {
  const [
    startedAt,
    setStartedAt,
  ] =
    useState(null);

  const [
    now,
    setNow,
  ] =
    useState(
      () =>
        Date.now()
    );

  // GAME_LOADING_OVERLAY_PROGRESS_LISTENER_PHASE1_1
  const [
    sourceProgress,
    setSourceProgress,
  ] =
    useState({});


  // GAME_LOADING_OVERLAY_VISUAL_POLISH_PHASE1_2
  const [
    shouldRender,
    setShouldRender,
  ] =
    useState(false);

  const [
    visible,
    setVisible,
  ] =
    useState(false);

  const [
    expanded,
    setExpanded,
  ] =
    useState(true);

  useEffect(
    () => {
      setSourceProgress({});
      setStartedAt(null);
    },
    [
      game?.id,
    ]
  );

  useEffect(
    () => {
      const handleProgress =
        (event) => {
          const detail =
            event?.detail;

          if (
            !detail ||
            !game?.id ||
            detail.gameId !== game.id ||
            !detail.sourceId
          ) {
            return;
          }

          setSourceProgress(
            (current) => ({
              ...current,
              [detail.sourceId]:
                detail.status === "error"
                  ? "error"
                  : "complete",
            })
          );
        };

      window.addEventListener(
        "gameatlas:game-loading-progress",
        handleProgress
      );

      return () =>
        window.removeEventListener(
          "gameatlas:game-loading-progress",
          handleProgress
        );
    },
    [
      game?.id,
    ]
  );

  const isLoading =
    Boolean(
      game &&
      (
        game.pcgwLoading ||
        game.renodxLoading ||
        game.vortexLoading
      )
    );

  useEffect(
    () => {
      if (!isLoading) {
        setSourceProgress({});
        return undefined;
      }

      setExpanded(true);

      const timer = window.setTimeout(
        () => setExpanded(false),
        5000
      );

      return () => window.clearTimeout(timer);
    },
    [game?.id, isLoading]
  );


  useEffect(
    () => {
      let frame =
        null;

      let hideTimer =
        null;

      if (isLoading) {
        setShouldRender(
          true
        );

        frame =
          requestAnimationFrame(
            () =>
              setVisible(
                true
              )
          );
      } else {
        setVisible(
          false
        );

        hideTimer =
          setTimeout(
            () =>
              setShouldRender(
                false
              ),
            220
          );
      }

      return () => {
        if (frame) {
          cancelAnimationFrame(
            frame
          );
        }

        if (hideTimer) {
          clearTimeout(
            hideTimer
          );
        }
      };
    },
    [
      game?.id,
      isLoading,
    ]
  );

  useEffect(
    () => {
      if (!isLoading) {
        setStartedAt(null);
        return undefined;
      }

      setStartedAt(
        (current) =>
          current ??
          Date.now()
      );

      setNow(
        Date.now()
      );

      const timer =
        setInterval(
          () =>
            setNow(
              Date.now()
            ),
          1000
        );

      return () =>
        clearInterval(
          timer
        );
    },
    [
      game?.id,
      isLoading,
    ]
  );

  const view =
    useMemo(
      () => {
        if (!game) {
          return null;
        }

        const steps = [
          {
            id: "pcgw",
            label: "PCGamingWiki",
            status:
              sourceProgress.pcgw
              ?? statusFor({
                loading:
                  game.pcgwLoading,
                loaded:
                  game.pcgwLoaded,
                error:
                  game.pcgwError,
              }),
          },
          {
            id: "renodx",
            label: "RenoDX / Luma",
            status:
              sourceProgress.renodx
              ?? statusFor({
                loading:
                  game.renodxLoading,
                loaded:
                  game.renodxLoaded,
                error:
                  game.renodxError,
              }),
          },
          {
            id: "vortex",
            label: "Vortex",
            status:
              sourceProgress.vortex
              ?? statusFor({
                loading:
                  game.vortexLoading,
                loaded:
                  game.vortexLoaded,
                error:
                  game.vortexError,
              }),
          },
        ];

        const finished =
          steps.filter(
            (step) =>
              step.status === "complete" ||
              step.status === "error"
          ).length;

        const failed =
          steps.filter(
            (step) =>
              step.status === "error"
          ).length;

        const elapsedSeconds =
          startedAt
            ? Math.max(
                0,
                Math.floor(
                  (now - startedAt)
                  / 1000
                )
              )
            : 0;

        return {
          steps,
          finished,
          failed,
          elapsedSeconds,
        };
      },
      [
        game,
        now,
        startedAt,
        sourceProgress,
      ]
    );

  if (
    !game ||
    !shouldRender ||
    !view
  ) {
    return null;
  }

  const longLoad =
    view.elapsedSeconds >= 5;

  return (
    <div
      className={
        `pointer-events-none fixed bottom-4 right-4 z-[60] transition-all duration-200 ease-out ${expanded ? "w-[min(26rem,calc(100vw-2rem))]" : "w-[min(20rem,calc(100vw-2rem))]"} ${
          visible
            ? "opacity-100"
            : "opacity-0"
        }`
      }
    >
      <div
        className={
          `w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/50 ring-1 ring-white/[0.035] transition-all duration-200 ease-out ${
            visible
              ? "pointer-events-auto translate-y-0 scale-100"
              : "pointer-events-none translate-y-2 scale-[0.985]"
          }`
        }
      >
        <div
          className="h-1 w-full bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400"
        />

        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={`Show loading details for ${game.name}`}
            className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
          >
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white/85">Loading {game.name}</span>
              <span className="mt-0.5 block text-xs text-slate-400">
                {view.finished} of {view.steps.length} sources finished{view.failed > 0 ? ` · ${view.failed} issue${view.failed === 1 ? "" : "s"}` : ""}
              </span>
            </span>
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ) : (
        <div
          className="p-5"
        >
          <div
            className="flex items-start gap-4"
          >
            <div
              className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/10 shadow-inner shadow-blue-300/5"
            >
              <span
                className="h-3 w-3 animate-pulse rounded-full bg-blue-300 shadow-[0_0_16px_rgba(147,197,253,0.75)]"
              />
            </div>

            <div
              className="min-w-0 flex-1"
            >
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300/80"
              >
                GameAtlas analysis
              </div>

              <div
                className="mt-1 text-xl font-semibold text-white"
              >
                Loading additional game data
              </div>

              <div
                className="mt-1 truncate text-sm font-medium text-slate-300"
              >
                {game.name}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Minimize loading details"
              className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div
            className="mt-5 flex items-center justify-between text-xs text-slate-400"
          >
            <span aria-live="polite">
              {view.finished}
              {" of "}
              {view.steps.length}
              {" sources finished"}
              {view.failed > 0 ? ` · ${view.failed} could not load` : ""}
            </span>

            <span
              className="tabular-nums text-slate-500"
            >
              {view.elapsedSeconds > 0
                ? `${view.elapsedSeconds}s elapsed`
                : "Starting…"}
            </span>
          </div>

        <div
          className="mt-5 grid gap-2"
        >
          {view.steps.map(
            (step) => (
              <div
                key={step.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.045] bg-white/[0.035] px-3.5 py-3 transition-colors duration-200"
              >
                <span
                  className={
                    `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      step.status === "complete"
                        ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-300"
                        : step.status === "error"
                          ? "border-amber-300/20 bg-amber-400/10 text-amber-300"
                          : step.status === "loading"
                            ? "border-blue-300/20 bg-blue-400/10 text-blue-300"
                            : "border-white/10 bg-white/[0.035] text-slate-500"
                    }`
                  }
                >
                  <span
                    className={
                      step.status === "loading"
                        ? "animate-pulse"
                        : ""
                    }
                  >
                    {statusSymbol(
                      step.status
                    )}
                  </span>
                </span>

                <span
                  className="text-sm text-slate-200"
                >
                  {step.label}
                </span>

                <span
                  className={
                    `ml-auto rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      step.status === "complete"
                        ? "border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-300"
                        : step.status === "error"
                          ? "border-amber-300/15 bg-amber-400/[0.07] text-amber-300"
                          : "border-white/[0.06] bg-white/[0.025] text-slate-400"
                    }`
                  }
                >
                  {statusLabel(
                    step.status
                  )}
                </span>
              </div>
            )
          )}
        </div>

          <div
            className={
              `mt-5 rounded-xl border px-3.5 py-3 text-sm ${
                longLoad
                  ? "border-amber-300/10 bg-amber-300/[0.035] text-amber-100/80"
                  : "border-white/[0.05] bg-white/[0.025] text-slate-300"
              }`
            }
          >
            {longLoad
              ? "Still working — some external services can take a few seconds."
              : "Gathering compatibility and mod data…"}
          </div>

          <div
            className="mt-3 text-center text-[11px] text-slate-600"
          >
            Game details remain available while analysis finishes.
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
