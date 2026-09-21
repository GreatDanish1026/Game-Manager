import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  FolderOpen,
  Loader2,
  Minus,
  Play,
  RefreshCw,
  Square,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getCurrentWindow,
} from "@tauri-apps/api/window";

import {
  cancelPerformanceCapture,
  getPerformanceCaptureHistory,
  getPerformanceCaptureStatus,
  removePerformanceCaptureHistoryEntry,
  runPerformanceCapture,
  setPerformanceCaptureBaseline,
} from "../services/performanceCapture";

import {
  openGamePath,
} from "../services/pathActions";


function FindingIcon({
  severity,
}) {
  if (severity === "warning") {
    return (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/85" />
    );
  }

  if (severity === "good") {
    return (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" />
    );
  }

  return (
    <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/65" />
  );
}


function metric(
  value,
  suffix = "",
  digits = 1
) {
  return Number.isFinite(
    value
  )
    ? `${value.toFixed(digits)}${suffix}`
    : "Unavailable";
}


function MetricCard({
  label,
  value,
  note,
  tone = "text-white/75",
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/15 px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/24">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold ${tone}`}>
        {value}
      </div>
      {note ? (
        <div className="mt-1 text-[10px] text-white/25">
          {note}
        </div>
      ) : null}
    </div>
  );
}


function formatCaptureDate(
  unix
) {
  return Number.isFinite(
    unix
  )
    ? new Date(
        unix
      ).toLocaleString()
    : "Unknown date";
}


function sceneIdentity(
  value
) {
  return String(
    value
    ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    )
    .toLocaleLowerCase();
}


function percentChange(
  value,
  baseline
) {
  if (
    !Number.isFinite(value)
    || !Number.isFinite(baseline)
    || baseline === 0
  ) {
    return null;
  }

  return (
    value
    - baseline
  )
  / baseline
  * 100;
}


function compareCapture(
  entry,
  baseline
) {
  if (
    !entry
    || !baseline
    || entry.id === baseline.id
    || entry.historyId === baseline.id
  ) {
    return null;
  }

  const average =
    percentChange(
      entry.averageFps,
      baseline.averageFps
    );

  const low =
    percentChange(
      entry.onePercentLowFps,
      baseline.onePercentLowFps
    );

  const p95 =
    percentChange(
      entry.p95FrameTimeMs,
      baseline.p95FrameTimeMs
    );

  const spikePoints =
    Number.isFinite(entry.spikePercent)
    && Number.isFinite(baseline.spikePercent)
      ? entry.spikePercent
        - baseline.spikePercent
      : null;

  let status =
    "similar";

  if (
    average <= -10
    || low <= -15
    || p95 >= 15
    || spikePoints >= 2
  ) {
    status =
      "regression";
  } else if (
    average <= -5
    || low <= -8
    || p95 >= 8
    || spikePoints >= 1
  ) {
    status =
      "possible-regression";
  } else if (
    average >= 5
    || low >= 8
    || p95 <= -8
  ) {
    status =
      "improvement";
  }

  return {
    average,
    low,
    p95,
    spikePoints,
    status,
  };
}


function Delta({
  value,
  lowerIsBetter = false,
  suffix = "%",
}) {
  if (!Number.isFinite(value)) {
    return (
      <span className="text-white/25">
        —
      </span>
    );
  }

  const improved =
    lowerIsBetter
      ? value < -0.5
      : value > 0.5;

  const regressed =
    lowerIsBetter
      ? value > 0.5
      : value < -0.5;

  return (
    <span className={improved ? "text-emerald-200/70" : regressed ? "text-amber-200/70" : "text-white/38"}>
      {value > 0
        ? "+"
        : ""}
      {value.toFixed(1)}{suffix}
    </span>
  );
}


function FrameTimeChart({
  values,
  threshold,
}) {
  const chart =
    useMemo(
      () => {
        if (!values?.length) {
          return null;
        }

        const sorted =
          [...values].sort(
            (
              left,
              right
            ) =>
              left
              - right
          );
        const p99 =
          sorted[
            Math.min(
              sorted.length
              - 1,
              Math.floor(
                sorted.length
                * 0.99
              )
            )
          ];
        const ceiling =
          Math.max(
            threshold
            * 1.35,
            p99
            * 1.15,
            20
          );
        const width =
          720;
        const height =
          120;
        const points =
          values.map(
            (
              value,
              index
            ) => {
              const x =
                values.length === 1
                  ? 0
                  : index
                    / (
                      values.length
                      - 1
                    )
                    * width;
              const y =
                height
                - Math.min(
                  value,
                  ceiling
                )
                / ceiling
                * height;

              return `${x.toFixed(1)},${y.toFixed(1)}`;
            }
          )
            .join(
              " "
            );

        return {
          width,
          height,
          points,
          thresholdY:
            height
            - Math.min(
              threshold,
              ceiling
            )
            / ceiling
            * height,
          ceiling,
        };
      },
      [
        threshold,
        values,
      ]
    );

  if (!chart) {
    return null;
  }

  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/15 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-white/58">
            Frame-time timeline
          </div>
          <div className="mt-0.5 text-[10px] text-white/24">
            Peaks are preserved when the capture is condensed for display.
          </div>
        </div>
        <div className="text-[10px] text-white/25">
          Scale 0–{chart.ceiling.toFixed(
            0
          )} ms
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-28 w-full overflow-visible"
        role="img"
        aria-label="Captured frame-time timeline"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1={chart.thresholdY}
          x2={chart.width}
          y2={chart.thresholdY}
          stroke="rgba(251, 191, 36, 0.28)"
          strokeDasharray="6 5"
        />
        <polyline
          fill="none"
          stroke="rgba(103, 232, 249, 0.72)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          points={chart.points}
        />
      </svg>

      <div className="mt-1 text-[10px] text-amber-100/35">
        Dashed line: {threshold.toFixed(
          1
        )} ms spike threshold
      </div>
    </div>
  );
}


function ComparisonSummary({
  report,
  history,
}) {
  const baseline =
    history?.entries
      ?.find(
        (entry) =>
          entry.isBaseline
          && sceneIdentity(
            entry.sceneLabel
          )
          === sceneIdentity(
            report?.sceneLabel
          )
      );

  if (
    !report?.historySaved
    || !baseline
  ) {
    return null;
  }

  if (
    report.historyId
    === baseline.id
  ) {
    return (
      <div className="flex items-start gap-3 border-b border-emerald-400/10 bg-emerald-400/[0.025] px-4 py-3">
        <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/70" />
        <div>
          <div className="text-xs font-semibold text-emerald-100/65">
            Baseline saved for “{report.sceneLabel}”
          </div>
          <div className="mt-0.5 text-[11px] text-white/28">
            Future captures using this exact scene label will be compared with this run.
          </div>
        </div>
      </div>
    );
  }

  const comparison =
    compareCapture(
      report,
      baseline
    );

  if (!comparison) {
    return null;
  }

  const appearance = {
    regression: {
      icon:
        TrendingDown,
      label:
        "Performance regression detected",
      className:
        "border-red-400/15 bg-red-400/[0.035] text-red-100/70",
    },
    "possible-regression": {
      icon:
        TrendingDown,
      label:
        "Possible performance regression",
      className:
        "border-amber-400/15 bg-amber-400/[0.035] text-amber-100/70",
    },
    improvement: {
      icon:
        TrendingUp,
      label:
        "Performance improvement detected",
      className:
        "border-emerald-400/15 bg-emerald-400/[0.035] text-emerald-100/70",
    },
    similar: {
      icon:
        Minus,
      label:
        "Performance is similar to baseline",
      className:
        "border-cyan-400/12 bg-cyan-400/[0.025] text-cyan-100/62",
    },
  }[comparison.status];

  const Icon =
    appearance.icon;

  return (
    <div className={`border-b px-4 py-3 ${appearance.className}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">
            {appearance.label}
          </div>
          <div className="mt-1 grid grid-cols-2 gap-x-5 gap-y-1 text-[11px] sm:grid-cols-4">
            <div>
              Average FPS <Delta value={comparison.average} />
            </div>
            <div>
              1% low <Delta value={comparison.low} />
            </div>
            <div>
              P95 frame time <Delta value={comparison.p95} lowerIsBetter />
            </div>
            <div>
              Spike rate <Delta value={comparison.spikePoints} lowerIsBetter suffix=" pts" />
            </div>
          </div>
          <div className="mt-1.5 text-[10px] text-white/25">
            Compared with {formatCaptureDate(baseline.createdUnix)} · use the same route, settings, and duration for the most reliable comparison.
          </div>
        </div>
      </div>
    </div>
  );
}


function CaptureHistory({
  game,
  history,
  setHistory,
  loading,
  error,
}) {
  const [
    busy,
    setBusy,
  ] =
    useState(null);

  const [
    removeId,
    setRemoveId,
  ] =
    useState(null);

  const [
    showAll,
    setShowAll,
  ] =
    useState(false);

  const [
    actionError,
    setActionError,
  ] =
    useState(null);


  async function setBaseline(
    entry
  ) {
    setBusy(
      entry.id
    );
    setActionError(
      null
    );

    try {
      setHistory(
        await setPerformanceCaptureBaseline(
          game,
          entry.id
        )
      );
    } catch (baselineError) {
      setActionError(
        String(
          baselineError
        )
      );
    } finally {
      setBusy(
        null
      );
    }
  }


  async function removeEntry(
    entry
  ) {
    setBusy(
      entry.id
    );
    setActionError(
      null
    );

    try {
      setHistory(
        await removePerformanceCaptureHistoryEntry(
          game,
          entry.id
        )
      );
      setRemoveId(
        null
      );
    } catch (removeError) {
      setActionError(
        String(
          removeError
        )
      );
    } finally {
      setBusy(
        null
      );
    }
  }


  const entries =
    history?.entries
    ?? [];

  const visible =
    showAll
      ? entries
      : entries.slice(
          0,
          8
        );


  return (
    <div className="border-t border-white/[0.06] bg-emerald-400/[0.012] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/[0.07] text-emerald-200/60">
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white/68">
              Performance Capture History
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/30">
              Tracks up to {history?.historyLimit ?? 50} summaries per game. Baselines are kept separately for each scene label.
            </div>
          </div>
        </div>

        {history?.historyDirectory
        && entries.length > 0 ? (
          <button
            type="button"
            onClick={
              () =>
                openGamePath(
                  history.historyDirectory,
                  history.historyDirectory
                )
            }
            className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[11px] font-semibold text-white/45 hover:bg-white/[0.06]"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            History Folder
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-white/28">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading capture history…
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-red-400/15 bg-red-400/[0.035] px-3 py-2 text-xs text-red-100/60">
          Capture history could not be loaded: {error}
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-3 rounded-lg border border-red-400/15 bg-red-400/[0.035] px-3 py-2 text-xs text-red-100/60">
          History could not be updated: {actionError}
        </div>
      ) : null}

      {!loading
      && !error
      && entries.length === 0 ? (
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/10 px-3 py-3 text-xs text-white/27">
          Complete a performance capture to create the first baseline for its scene label.
        </div>
      ) : null}

      {entries.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07]">
          {visible.map(
            (entry) => {
              const baseline =
                entries.find(
                  (candidate) =>
                    candidate.isBaseline
                    && sceneIdentity(
                      candidate.sceneLabel
                    )
                    === sceneIdentity(
                      entry.sceneLabel
                    )
                );

              const comparison =
                compareCapture(
                  entry,
                  baseline
                );

              return (
                <div
                  key={entry.id}
                  className="border-b border-white/[0.055] px-3 py-3 last:border-b-0"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-xs font-semibold text-white/60">
                          {entry.sceneLabel}
                        </div>
                        {entry.isBaseline ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-400/[0.05] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-100/55">
                            <Bookmark className="h-2.5 w-2.5" />
                            Baseline
                          </span>
                        ) : comparison ? (
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${comparison.status === "regression" ? "border-red-300/15 bg-red-400/[0.04] text-red-100/55" : comparison.status === "possible-regression" ? "border-amber-300/15 bg-amber-400/[0.04] text-amber-100/55" : comparison.status === "improvement" ? "border-emerald-300/15 bg-emerald-400/[0.04] text-emerald-100/55" : "border-white/10 bg-white/[0.025] text-white/35"}`}>
                            {comparison.status.replace("-", " ")}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/24">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatCaptureDate(entry.createdUnix)}
                        </span>
                        <span>{entry.requestedDurationSeconds}s</span>
                        <span>{entry.frameCount.toLocaleString()} frames</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[10px] sm:grid-cols-4 lg:min-w-[360px]">
                      <div className="text-white/28">
                        Avg <span className="text-white/60">{entry.averageFps.toFixed(1)}</span>
                        {comparison ? <> <Delta value={comparison.average} /></> : null}
                      </div>
                      <div className="text-white/28">
                        1% <span className="text-white/60">{entry.onePercentLowFps.toFixed(1)}</span>
                        {comparison ? <> <Delta value={comparison.low} /></> : null}
                      </div>
                      <div className="text-white/28">
                        P95 <span className="text-white/60">{entry.p95FrameTimeMs.toFixed(1)} ms</span>
                      </div>
                      <div className="text-white/28">
                        Spikes <span className="text-white/60">{entry.spikePercent.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {!entry.isBaseline ? (
                        <button
                          type="button"
                          onClick={
                            () =>
                              setBaseline(
                                entry
                              )
                          }
                          disabled={Boolean(busy)}
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-[9px] font-semibold text-white/40 hover:bg-white/[0.05] disabled:opacity-35"
                        >
                          <Bookmark className="h-3 w-3" />
                          Use as Baseline
                        </button>
                      ) : null}

                      {removeId === entry.id ? (
                        <>
                          <button
                            type="button"
                            onClick={
                              () =>
                                removeEntry(
                                  entry
                                )
                            }
                            disabled={Boolean(busy)}
                            className="rounded-md border border-red-300/15 bg-red-400/[0.05] px-2 py-1.5 text-[9px] font-semibold text-red-100/60 disabled:opacity-35"
                          >
                            Confirm Remove
                          </button>
                          <button
                            type="button"
                            onClick={
                              () =>
                                setRemoveId(
                                  null
                                )
                            }
                            disabled={Boolean(busy)}
                            className="rounded-md border border-white/10 px-2 py-1.5 text-[9px] font-semibold text-white/38 disabled:opacity-35"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={
                            () =>
                              setRemoveId(
                                entry.id
                              )
                          }
                          disabled={Boolean(busy)}
                          title="Remove summary from history; keep raw CSV"
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-[9px] font-semibold text-white/32 hover:bg-red-400/[0.04] hover:text-red-100/55 disabled:opacity-35"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      ) : null}

      {entries.length > 8 ? (
        <button
          type="button"
          onClick={
            () =>
              setShowAll(
                (current) =>
                  !current
              )
          }
          className="mt-3 text-[10px] font-semibold text-emerald-100/45 hover:text-emerald-100/65"
        >
          {showAll
            ? "Show recent captures"
            : `Show all ${entries.length} captures`}
        </button>
      ) : null}

      <div className="mt-3 text-[10px] leading-relaxed text-white/20">
        Removing a history entry does not delete its raw CSV. Automatic regression labels are indicators; scene, settings, duration, background activity, and shader compilation can all affect results.
      </div>
    </div>
  );
}


export default function PerformanceCapturePanel({
  game,
}) {
  const requestId =
    useRef(
      0
    );

  const [
    status,
    setStatus,
  ] =
    useState(null);

  const [
    report,
    setReport,
  ] =
    useState(null);

  const [
    duration,
    setDuration,
  ] =
    useState(30);

  const [
    sceneLabel,
    setSceneLabel,
  ] =
    useState(
      "General gameplay"
    );

  const [
    history,
    setHistory,
  ] =
    useState(null);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  const [
    historyError,
    setHistoryError,
  ] =
    useState(null);

  const [
    remaining,
    setRemaining,
  ] =
    useState(null);

  const [
    capturing,
    setCapturing,
  ] =
    useState(false);

  const [
    cancelling,
    setCancelling,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);


  async function refreshStatus() {
    try {
      setStatus(
        await getPerformanceCaptureStatus(
          game
        )
      );
    } catch (statusError) {
      setError(
        String(
          statusError
        )
      );
    }
  }


  async function refreshHistory() {
    setHistoryLoading(
      true
    );
    setHistoryError(
      null
    );

    try {
      setHistory(
        await getPerformanceCaptureHistory(
          game
        )
      );
    } catch (loadError) {
      setHistoryError(
        String(
          loadError
        )
      );
    } finally {
      setHistoryLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      requestId.current +=
        1;
      setStatus(
        null
      );
      setReport(
        null
      );
      setError(
        null
      );
      setHistory(
        null
      );
      setHistoryError(
        null
      );
      setCapturing(
        false
      );
      setRemaining(
        null
      );
      refreshStatus();
      refreshHistory();
    },
    [
      game?.id,
      game?.installPath,
    ]
  );


  useEffect(
    () => {
      if (
        !capturing
        || remaining === null
      ) {
        return undefined;
      }

      const timer =
        window.setInterval(
          () =>
            setRemaining(
              (current) =>
                current === null
                  ? null
                  : Math.max(
                    0,
                    current
                    - 1
                  )
            ),
          1000
        );

      return () =>
        window.clearInterval(
          timer
        );
    },
    [
      capturing,
      remaining === null,
    ]
  );


  useEffect(
    () => {
      if (capturing) {
        return undefined;
      }

      const timer =
        window.setInterval(
          refreshStatus,
          3000
        );

      return () =>
        window.clearInterval(
          timer
        );
    },
    [
      capturing,
      game?.id,
      game?.installPath,
    ]
  );


  async function startCapture() {
    const currentRequest =
      requestId.current
      + 1;
    requestId.current =
      currentRequest;
    setCapturing(
      true
    );
    setRemaining(
      duration
      + 3
    );
    setError(
      null
    );

    let captureWindow =
      null;
    let restoreWindow =
      false;

    try {
      if (
        status?.providerName
        === "MangoHud"
      ) {
        try {
          captureWindow =
            getCurrentWindow();
          await captureWindow.minimize();
          restoreWindow =
            true;
        } catch {
          captureWindow =
            null;
        }
      }

      const next =
        await runPerformanceCapture(
          game,
          duration,
          sceneLabel
        );

      if (
        requestId.current
        === currentRequest
      ) {
        setReport(
          next
        );
        await refreshHistory();
      }
    } catch (captureError) {
      if (
        requestId.current
        === currentRequest
      ) {
        setError(
          String(
            captureError
          )
        );
      }
    } finally {
      if (
        requestId.current
        === currentRequest
      ) {
        setCapturing(
          false
        );
        setCancelling(
          false
        );
        setRemaining(
          null
        );
        refreshStatus();
      }

      if (
        restoreWindow
        && captureWindow
      ) {
        try {
          await captureWindow.unminimize();
          await captureWindow.setFocus();
        } catch {
          // The capture result is still valid if the desktop declines the
          // window activation request.
        }
      }
    }
  }


  async function stopCapture() {
    setCancelling(
      true
    );

    try {
      await cancelPerformanceCapture();
    } catch (cancelError) {
      setError(
        String(
          cancelError
        )
      );
      setCancelling(
        false
      );
    }
  }


  const canCapture =
    status?.providerReady
    && status?.executableName
    && status?.gameRunning
    && !capturing;


  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-black/10">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
            <Activity className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-semibold text-white/75">
              Performance Capture
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Records presented frames for a running game and calculates average FPS, 1% lows, frame-time percentiles, and large spikes.
            </div>
            <div className="mt-2 text-[11px] text-white/24">
              Launch the game and reach a repeatable scene first. On Linux, GameAtlas minimizes during capture so the game can keep rendering, then restores after MangoHud finalizes the CSV.
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <input
            type="text"
            value={sceneLabel}
            onChange={
              (event) =>
                setSceneLabel(
                  event.target.value
                    .slice(
                      0,
                      80
                    )
                )
            }
            list="performance-scene-labels"
            disabled={capturing}
            placeholder="Scene label"
            aria-label="Repeatable scene label"
            className="min-w-[170px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60 outline-none placeholder:text-white/20 focus:border-emerald-300/25 disabled:opacity-40"
          />
          <datalist id="performance-scene-labels">
            {[...new Set(
              history?.entries
                ?.map(
                  (entry) =>
                    entry.sceneLabel
                )
              ?? []
            )].map(
              (label) => (
                <option
                  key={label}
                  value={label}
                />
              )
            )}
          </datalist>

          <select
            value={duration}
            onChange={
              (event) =>
                setDuration(
                  Number(
                    event.target.value
                  )
                )
            }
            disabled={capturing}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60 outline-none disabled:opacity-40"
            aria-label="Capture duration"
          >
            <option value={15}>15 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>60 seconds</option>
          </select>

          {capturing ? (
            <button
              type="button"
              onClick={stopCapture}
              disabled={cancelling}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-xs font-semibold text-red-100/70 hover:bg-red-400/[0.1] disabled:opacity-40"
            >
              {cancelling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={startCapture}
              disabled={!canCapture}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-xs font-semibold text-emerald-100/75 hover:bg-emerald-400/[0.12] disabled:opacity-40"
            >
              {report ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {report
                ? "Capture Again"
                : "Start Capture"}
            </button>
          )}
        </div>
      </div>

      {capturing ? (
        <div className="border-b border-emerald-400/10 bg-emerald-400/[0.025] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-emerald-100/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {
              remaining === 0
                ? "Finalizing capture… return to the game and keep it actively rendering until this message clears."
                : remaining > duration
                  ? `Return to the game now… capture begins in ${remaining - duration} seconds`
                  : `Capturing ${status?.executableName ?? "game frames"}… keep the game active for approximately ${remaining ?? duration} more seconds`
            }
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-emerald-300/55 transition-all duration-1000"
              style={{
                width:
                  `${Math.min(
                    100,
                    Math.max(
                      2,
                      (
                        1
                        - (
                          remaining
                          ?? duration
                        )
                        / (
                          duration
                          + 3
                        )
                      )
                      * 100
                    )
                  )}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-4 py-3 text-xs text-red-200/70">
          Performance Capture could not finish: {error}
        </div>
      ) : null}

      {!capturing
      && status ? (
        <div className="flex flex-col gap-2 border-b border-white/[0.06] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className={status.providerReady ? "text-white/38" : "text-red-200/65"}>
            {status.detail}
          </div>
          <div className="shrink-0 text-[10px] text-white/22">
            {status.providerName} {status.providerVersion ?? ""} · capture provider
          </div>
        </div>
      ) : null}

      {report ? (
        <>
          <ComparisonSummary
            report={
              report
            }
            history={
              history
            }
          />

          <div className="grid grid-cols-2 gap-3 border-b border-white/[0.06] p-4 lg:grid-cols-4">
            <MetricCard
              label="Average FPS"
              value={metric(
                report.averageFps
              )}
              note={`${report.frameCount.toLocaleString()} frames`}
              tone="text-emerald-200/80"
            />
            <MetricCard
              label="1% Low"
              value={metric(
                report.onePercentLowFps,
                " FPS"
              )}
              note="Average of slowest 1%"
              tone="text-cyan-200/75"
            />
            <MetricCard
              label="Average frame time"
              value={metric(
                report.averageFrameTimeMs,
                " ms",
                2
              )}
              note={`P99 ${metric(report.p99FrameTimeMs, " ms", 2)}`}
            />
            <MetricCard
              label="Large spikes"
              value={report.spikeCount.toLocaleString()}
              note={`${metric(report.spikePercent, "%")} above ${metric(report.spikeThresholdMs, " ms")}`}
              tone={report.spikePercent > 1 ? "text-amber-200/80" : "text-emerald-200/75"}
            />
          </div>

          <div className="border-b border-white/[0.06] p-4">
            <FrameTimeChart
              values={report.frameTimesMs}
              threshold={report.spikeThresholdMs}
            />

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <div className="rounded-md bg-white/[0.025] px-3 py-2 text-white/38">
                Median <span className="text-white/62">{metric(report.medianFrameTimeMs, " ms", 2)}</span>
              </div>
              <div className="rounded-md bg-white/[0.025] px-3 py-2 text-white/38">
                P95 <span className="text-white/62">{metric(report.p95FrameTimeMs, " ms", 2)}</span>
              </div>
              <div className="rounded-md bg-white/[0.025] px-3 py-2 text-white/38">
                CPU busy <span className="text-white/62">{metric(report.averageCpuBusyMs, " ms", 2)}</span>
              </div>
              <div className="rounded-md bg-white/[0.025] px-3 py-2 text-white/38">
                GPU time <span className="text-white/62">{metric(report.averageGpuTimeMs, " ms", 2)}</span>
              </div>
            </div>
          </div>

          <div>
            {report.findings.map(
              (
                finding,
                index
              ) => (
                <div
                  key={`${finding.title}-${index}`}
                  className="flex items-start gap-3 border-b border-white/[0.055] px-4 py-3 last:border-b-0"
                >
                  <FindingIcon severity={finding.severity} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium ${finding.severity === "warning" ? "text-amber-100/75" : "text-white/68"}`}>
                      {finding.title}
                    </div>
                    <div className="mt-0.5 text-xs leading-relaxed text-white/32">
                      {finding.detail}
                    </div>
                    {finding.suggestion ? (
                      <div className="mt-1.5 text-xs leading-relaxed text-cyan-100/48">
                        Suggested: {finding.suggestion}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-white/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] leading-relaxed text-white/24">
              {report.provider} · {report.frameTimeMetric} · {report.presentRuntime ?? "runtime unknown"} · {report.presentMode ?? "present mode unknown"}
            </div>
            <button
              type="button"
              onClick={
                () =>
                  openGamePath(
                    report.dataDirectory,
                    report.dataDirectory
                  )
              }
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-white/48 hover:bg-white/[0.06] hover:text-white/70"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open Capture Folder
            </button>
          </div>
        </>
      ) : (
        !capturing ? (
          <div className="p-4 text-xs leading-relaxed text-white/28">
            Performance Capture is read-only. It uses {status?.providerName ?? "the platform capture provider"}, does not modify game files, and stores the raw CSV locally for repeatable comparisons.
          </div>
        ) : null
      )}

      <CaptureHistory
        game={
          game
        }
        history={
          history
        }
        setHistory={
          setHistory
        }
        loading={
          historyLoading
        }
        error={
          historyError
        }
      />
    </div>
  );
}
