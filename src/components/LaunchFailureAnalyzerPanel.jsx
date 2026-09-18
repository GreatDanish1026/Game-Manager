import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Loader2,
  Play,
  Radar,
  Square,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  launchDefaultProfile,
} from "../services/launchProfiles";

import {
  cancelLaunchFailureMonitor,
  monitorGameLaunch,
} from "../services/launchFailureAnalyzer";

import {
  getCrashDetectiveReport,
} from "../services/crashDetective";

import {
  getRuntimeDependencyReport,
} from "../services/runtimeDependencyDoctor";

import {
  getConfigurationValidationReport,
} from "../services/configurationValidator";


function wait(
  milliseconds
) {
  return new Promise(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}


function ResultIcon({
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


function currentCrashEvents(
  report,
  lifecycle
) {
  const earliest =
    lifecycle.startedAtUnixMs
    - 5000;

  const latest =
    lifecycle.finishedAtUnixMs
    + 60000;

  return (
    report?.events
    ?? []
  ).filter(
    (event) => {
      const occurred =
        new Date(
          event.occurredAt
        ).getTime();

      return Number.isFinite(
        occurred
      )
        && occurred >= earliest
        && occurred <= latest;
    }
  );
}


function correlatedFindings(
  lifecycle,
  crashResult,
  runtimeResult,
  configurationResult
) {
  const findings =
    [];

  if (
    crashResult.status
      === "fulfilled"
  ) {
    const events =
      currentCrashEvents(
        crashResult.value,
        lifecycle
      );

    if (events.length > 0) {
      const event =
        events[0];

      findings.push({
        severity:
          "warning",
        source:
          "Crash Detective",
        title:
          `Windows recorded ${String(event.eventType ?? "a crash").toLowerCase()}`,
        detail:
          `The event matches this launch window${event.faultingModule ? ` and names ${event.faultingModule} as the faulting module` : ""}${event.exceptionCode ? ` with exception ${event.exceptionCode}` : ""}.`,
        suggestion:
          crashResult.value.findings?.find(
            (item) =>
              item.severity
                === "warning"
          )?.suggestion
          ?? "Open Crash Detective for the complete event record and targeted next steps.",
      });
    } else {
      findings.push({
        severity:
          "info",
        source:
          "Crash Detective",
        title:
          "No matching Windows crash event",
        detail:
          "Windows did not write a matching crash or hang record during this launch window. A clean early exit, launcher handoff, DRM, anti-cheat, or configuration issue can still stop startup without creating one.",
        suggestion:
          "If the problem repeats, scan Crash Detective again after a short delay because Windows can publish events late.",
      });
    }
  }

  const survived =
    Number.isFinite(
      lifecycle.survivedSeconds
    )
      ? `${lifecycle.survivedSeconds.toFixed(1)} seconds`
      : "before the process appeared";

  findings.push({
    severity:
      "warning",
    source:
      "Launch monitor",
    title:
      lifecycle.outcome
        === "not_detected"
        ? "Expected game process was not detected"
        : "Game exited during startup",
    detail:
      lifecycle.outcome
        === "not_detected"
        ? lifecycle.detail
        : `The monitored process remained active for ${survived}${lifecycle.exitCode ? ` and reported exit code ${lifecycle.exitCode}` : ""}.`,
    suggestion:
      lifecycle.outcome
        === "not_detected"
        ? "Confirm the detected primary executable. Launchers that start a differently named process may require a direct launch profile."
        : "Review the evidence below as possible leads; an early exit alone does not identify a single cause.",
  });

  if (
    runtimeResult.status
      === "fulfilled"
  ) {
    (
      runtimeResult.value
        ?.checks
      ?? []
    )
      .filter(
        (item) =>
          item.severity
            === "warning"
      )
      .slice(
        0,
        2
      )
      .forEach(
        (item) => {
          findings.push({
            severity:
              "warning",
            source:
              "Runtime Doctor",
            title:
              item.name,
            detail:
              item.detail,
            suggestion:
              item.suggestion,
          });
        }
      );
  }

  if (
    configurationResult.status
      === "fulfilled"
  ) {
    (
      configurationResult.value
        ?.issues
      ?? []
    )
      .filter(
        (item) =>
          item.severity
            === "warning"
      )
      .slice(
        0,
        2
      )
      .forEach(
        (item) => {
          findings.push({
            severity:
              "warning",
            source:
              "Configuration",
            title:
              item.title,
            detail:
              item.detail,
            suggestion:
              item.suggestion,
          });
        }
      );
  }

  return findings;
}


function metric(
  value,
  suffix = ""
) {
  return Number.isFinite(
    value
  )
    ? `${value.toFixed(1)}${suffix}`
    : "—";
}


export default function LaunchFailureAnalyzerPanel({
  game,
}) {
  const runId =
    useRef(0);

  const active =
    useRef(false);

  const cancellationRequested =
    useRef(false);

  const [
    running,
    setRunning,
  ] = useState(false);

  const [
    stopping,
    setStopping,
  ] = useState(false);

  const [
    phase,
    setPhase,
  ] = useState(null);

  const [
    lifecycle,
    setLifecycle,
  ] = useState(null);

  const [
    findings,
    setFindings,
  ] = useState([]);

  const [
    error,
    setError,
  ] = useState(null);


  useEffect(
    () => {
      runId.current +=
        1;

      cancellationRequested.current =
        true;

      if (active.current) {
        cancelLaunchFailureMonitor()
          .catch(
            () => {}
          );
      }

      active.current =
        false;

      setRunning(false);
      setStopping(false);
      setPhase(null);
      setLifecycle(null);
      setFindings([]);
      setError(null);
    },
    [
      game?.id,
      game?.installPath,
    ]
  );


  useEffect(
    () =>
      () => {
        runId.current +=
          1;

        cancellationRequested.current =
          true;

        if (active.current) {
          cancelLaunchFailureMonitor()
            .catch(
              () => {}
            );
        }
      },
    []
  );


  async function analyze() {
    const currentRun =
      runId.current
      + 1;

    runId.current =
      currentRun;

    cancellationRequested.current =
      false;

    setRunning(true);
    setStopping(false);
    setLifecycle(null);
    setFindings([]);
    setError(null);
    setPhase(
      "Preparing the process monitor…"
    );

    let monitorPromise;

    try {
      monitorPromise =
        monitorGameLaunch(
          game
        );

      active.current =
        true;

      const monitorReadiness =
        await Promise.race([
          monitorPromise.then(
            (report) => ({
              finished:
                true,
              report,
            })
          ),
          wait(500).then(
            () => ({
              finished:
                false,
            })
          ),
        ]);

      if (
        monitorReadiness.finished
      ) {
        active.current =
          false;

        setLifecycle(
          monitorReadiness.report
        );

        setPhase(null);
        return;
      }

      if (
        cancellationRequested.current
        || runId.current
          !== currentRun
      ) {
        await cancelLaunchFailureMonitor()
          .catch(
            () => {}
          );

        await monitorPromise
          .catch(
            () => {}
          );

        active.current =
          false;
        return;
      }

      setPhase(
        "Sending the normal launch request…"
      );

      try {
        await launchDefaultProfile(
          game
        );
      } catch (launchError) {
        await cancelLaunchFailureMonitor()
          .catch(
            () => {}
          );

        await monitorPromise
          .catch(
            () => {}
          );

        throw launchError;
      }

      setPhase(
        "Watching the game through its startup window…"
      );

      const nextLifecycle =
        await monitorPromise;

      active.current =
        false;

      if (
        runId.current
          !== currentRun
      ) {
        return;
      }

      setLifecycle(
        nextLifecycle
      );

      if (
        nextLifecycle.outcome
          === "cancelled"
      ) {
        setPhase(null);
        return;
      }

      if (
        nextLifecycle.outcome
          === "stable"
      ) {
        setFindings([
          {
            severity:
              "good",
            source:
              "Launch monitor",
            title:
              "Startup remained active",
            detail:
              nextLifecycle.detail,
            suggestion:
              "No launch failure was observed. You can stop the game normally when you are finished testing.",
          },
        ]);

        setPhase(null);
        return;
      }

      setPhase(
        "Correlating crash, runtime, and configuration evidence…"
      );

      await wait(1500);

      const [
        crashResult,
        runtimeResult,
        configurationResult,
      ] = await Promise.allSettled([
        getCrashDetectiveReport(
          game
        ),
        getRuntimeDependencyReport(
          game
        ),
        getConfigurationValidationReport(
          game
        ),
      ]);

      if (
        runId.current
          !== currentRun
      ) {
        return;
      }

      setFindings(
        correlatedFindings(
          nextLifecycle,
          crashResult,
          runtimeResult,
          configurationResult
        )
      );

      setPhase(null);
    } catch (runError) {
      active.current =
        false;

      if (
        runId.current
          === currentRun
      ) {
        setError(
          String(
            runError
          )
        );

        setPhase(null);
      }
    } finally {
      if (
        runId.current
          === currentRun
      ) {
        setRunning(false);
        setStopping(false);
      }
    }
  }


  async function stop() {
    cancellationRequested.current =
      true;

    setStopping(true);

    try {
      await cancelLaunchFailureMonitor();
      setPhase(
        "Stopping the monitor without closing the game…"
      );
    } catch (stopError) {
      setError(
        String(
          stopError
        )
      );
      setStopping(false);
    }
  }


  const successful =
    lifecycle?.outcome
      === "stable";


  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-black/10">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300">
            <Radar className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-semibold text-white/75">
              Launch Failure Analyzer
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Starts the normal launch profile under observation, checks whether the game process appears and survives startup, then correlates existing diagnostics when it exits early.
            </div>

            <div className="mt-2 text-[10px] leading-relaxed text-white/25">
              Observation lasts up to 45 seconds for process appearance and 20 seconds after detection. This does not close or modify the game.
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {running ? (
            <button
              type="button"
              onClick={stop}
              disabled={stopping}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/55 hover:bg-white/[0.07] disabled:opacity-40"
            >
              {stopping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Stop Monitoring
            </button>
          ) : (
            <button
              type="button"
              onClick={analyze}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/15 bg-rose-500/[0.08] px-3 py-2 text-xs font-semibold text-rose-100/70 hover:bg-rose-500/[0.14]"
            >
              <Play className="h-3.5 w-3.5" />
              {lifecycle
                ? "Run Again"
                : "Run Monitored Launch"}
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-4 py-3 text-xs text-red-200/70">
          The monitored launch could not be completed: {error}
        </div>
      ) : null}

      {phase ? (
        <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-sm text-white/38">
          <Loader2 className="h-4 w-4 animate-spin text-rose-300/70" />
          {phase}
        </div>
      ) : null}

      {lifecycle ? (
        <div className="border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-2">
            {successful ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-300/80" />
            ) : lifecycle.outcome === "cancelled" ? (
              <CircleHelp className="h-4 w-4 text-white/35" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-300/85" />
            )}

            <div className={`text-sm font-semibold ${successful ? "text-emerald-100/70" : "text-white/68"}`}>
              {successful
                ? "No launch failure observed"
                : lifecycle.outcome === "cancelled"
                  ? "Monitoring stopped"
                  : lifecycle.outcome === "not_detected"
                    ? "Game process was not detected"
                    : "Early launch exit detected"}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg bg-white/[0.025] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-white/22">
                Process
              </div>
              <div className="mt-1 truncate text-xs text-white/50">
                {lifecycle.processName
                ?? "Not detected"}
              </div>
            </div>

            <div className="rounded-lg bg-white/[0.025] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-white/22">
                Appeared after
              </div>
              <div className="mt-1 text-xs text-white/50">
                {metric(
                  lifecycle.appearedAfterSeconds,
                  "s"
                )}
              </div>
            </div>

            <div className="rounded-lg bg-white/[0.025] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-white/22">
                Observed for
              </div>
              <div className="mt-1 text-xs text-white/50">
                {metric(
                  lifecycle.survivedSeconds,
                  "s"
                )}
              </div>
            </div>

            <div className="rounded-lg bg-white/[0.025] px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-white/22">
                Exit code
              </div>
              <div className="mt-1 font-mono text-xs text-white/50">
                {lifecycle.exitCode
                ?? "—"}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {findings.length > 0 ? (
        <div className="space-y-2 p-4">
          {findings.map(
            (
              item,
              index
            ) => (
              <div
                key={`${item.source}-${item.title}-${index}`}
                className="rounded-lg border border-white/[0.07] bg-black/10 p-3"
              >
                <div className="flex items-start gap-2.5">
                  <ResultIcon severity={item.severity} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-white/68">
                        {item.title}
                      </div>
                      <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/28">
                        {item.source}
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs leading-relaxed text-white/35">
                      {item.detail}
                    </div>

                    {item.suggestion ? (
                      <div className="mt-2 text-xs leading-relaxed text-cyan-100/48">
                        Suggested: {item.suggestion}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      ) : !running && !lifecycle ? (
        <div className="flex items-start gap-3 p-4 text-xs leading-relaxed text-white/30">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
          Close the game before starting. The analyzer uses your current default launch profile, including launcher-based profiles.
        </div>
      ) : null}
    </div>
  );
}
