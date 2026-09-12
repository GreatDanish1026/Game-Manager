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
    return "Loaded with issue";
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

  useEffect(
    () => {
      setSourceProgress({});
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

        const active =
          steps.some(
            (step) =>
              step.status === "loading"
          );

        const percent =
          active
            ? Math.max(
                8,
                Math.round(
                  (finished / steps.length)
                  * 100
                )
              )
            : 100;

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
          percent,
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
      aria-live="polite"
      aria-busy="true"
      className={
        `fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-[4px] transition-opacity duration-200 ease-out ${
          visible
            ? "opacity-100"
            : "opacity-0"
        }`
      }
    >
      <div
        className={
          `w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/50 ring-1 ring-white/[0.035] transition-all duration-200 ease-out ${
            visible
              ? "translate-y-0 scale-100"
              : "translate-y-2 scale-[0.985]"
          }`
        }
      >
        <div
          className="h-1 w-full bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400"
        />

        <div
          className="p-6"
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
                Loading Game Data
              </div>

              <div
                className="mt-1 truncate text-sm font-medium text-slate-300"
              >
                {game.name}
              </div>
            </div>

            <div
              className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-300"
            >
              {view.percent}
              {"%"}
            </div>
          </div>

          <div
            className="mt-6 h-2.5 overflow-hidden rounded-full bg-black/30 ring-1 ring-white/[0.045]"
          >
            <div
              className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400 shadow-[0_0_18px_rgba(96,165,250,0.28)] transition-[width] duration-500 ease-out"
              style={{
                width:
                  `${view.percent}%`,
              }}
            >
              <div
                className="absolute inset-y-0 right-0 w-12 animate-pulse bg-gradient-to-r from-transparent to-white/30"
              />
            </div>
          </div>

          <div
            className="mt-2 flex items-center justify-between text-xs text-slate-400"
          >
            <span>
              {view.finished}
              {" / "}
              {view.steps.length}
              {" sources loaded"}
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
            Game details will open automatically when analysis is ready.
          </div>
        </div>
      </div>
    </div>
  );
}
