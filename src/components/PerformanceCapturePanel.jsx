import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  FolderOpen,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Timer,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  cancelPerformanceCapture,
  getPerformanceCaptureStatus,
  runPerformanceCapture,
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
      setCapturing(
        false
      );
      setRemaining(
        null
      );
      refreshStatus();
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

    try {
      const next =
        await runPerformanceCapture(
          game,
          duration
        );

      if (
        requestId.current
        === currentRequest
      ) {
        setReport(
          next
        );
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
              Launch the game and reach a repeatable scene first. Capture starts after a 3-second preparation delay.
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
            Capturing {status?.executableName ?? "game frames"}… approximately {remaining ?? duration} seconds remaining
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
            {status.providerName} {status.providerVersion ?? ""} · integrity verified
          </div>
        </div>
      ) : null}

      {report ? (
        <>
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
            Performance Capture is read-only. It uses Windows ETW through PresentMon, does not inject into the game, and stores the raw CSV locally for repeatable comparisons.
          </div>
        ) : null
      )}
    </div>
  );
}
