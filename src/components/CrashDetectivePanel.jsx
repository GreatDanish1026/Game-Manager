import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileWarning,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getCrashDetectiveReport,
} from "../services/crashDetective";


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


function formatDate(value) {
  if (!value) {
    return "Unknown time";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}


function CrashEventCard({
  event,
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/10 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
            <FileWarning className="h-4 w-4 shrink-0 text-amber-300/70" />
            {event.eventType}
          </div>

          <div className="mt-1 break-all text-xs text-white/42">
            {event.applicationName}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-white/28">
          <Clock3 className="h-3 w-3" />
          {formatDate(
            event.occurredAt
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-md bg-white/[0.025] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-white/22">
            Faulting module
          </div>
          <div className="mt-1 break-all text-white/48">
            {event.faultingModule
            ?? "Not recorded"}
          </div>
        </div>

        <div className="rounded-md bg-white/[0.025] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-white/22">
            Exception code
          </div>
          <div className="mt-1 break-all font-mono text-white/48">
            {event.exceptionCode
            ?? "Not recorded"}
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-white/20">
        Windows event {event.eventId} · {event.provider}
      </div>
    </div>
  );
}


export default function CrashDetectivePanel({
  game,
}) {
  const requestId =
    useRef(
      0
    );

  const [
    report,
    setReport,
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


  useEffect(
    () => {
      requestId.current +=
        1;

      setReport(
        null
      );

      setLoading(
        false
      );

      setError(
        null
      );
    },
    [
      game?.id,
      game?.installPath,
    ]
  );


  async function refresh() {
    const currentRequest =
      requestId.current
      + 1;

    requestId.current =
      currentRequest;

    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const next =
        await getCrashDetectiveReport(
          game
        );

      if (
        requestId.current
        !== currentRequest
      ) {
        return;
      }

      setReport(
        next
      );
    } catch (loadError) {
      if (
        requestId.current
        !== currentRequest
      ) {
        return;
      }

      setError(
        String(
          loadError
        )
      );
    } finally {
      if (
        requestId.current
        === currentRequest
      ) {
        setLoading(
          false
        );
      }
    }
  }


  if (
    !loading
    && report
    && !report.supported
  ) {
    return null;
  }


  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-black/10">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <Bug className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-semibold text-white/75">
              Crash Detective
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Checks recent Windows Application log records for crashes or hangs matching this game's executable, then explains useful evidence without claiming a single cause.
            </div>

            {report ? (
              <div className={`mt-2 text-xs ${report.events.length > 0 ? "text-amber-200/70" : "text-emerald-200/60"}`}>
                {report.summary}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/55 hover:bg-white/[0.07] disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {report
            ? "Scan Again"
            : "Scan Recent Crashes"}
        </button>
      </div>


      {error ? (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-4 py-3 text-xs text-red-200/70">
          Crash Detective could not read the Windows Application log: {error}
        </div>
      ) : null}


      {loading
      && !report ? (
        <div className="flex items-center gap-3 p-4 text-sm text-white/35">
          <Loader2 className="h-4 w-4 animate-spin" />
          Matching recent Windows crash and hang records…
        </div>
      ) : null}


      {report ? (
        <>
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

          {report.events.length > 0 ? (
            <details className="border-t border-white/[0.06] p-4">
              <summary className="cursor-pointer text-xs font-semibold text-white/58">
                View matched Windows records ({report.events.length})
              </summary>

              <div className="mt-3 space-y-2">
                {report.events.map(
                  (
                    event,
                    index
                  ) => (
                    <CrashEventCard
                      key={`${event.occurredAt}-${event.eventId}-${index}`}
                      event={event}
                    />
                  )
                )}
              </div>
            </details>
          ) : null}

          <div className="border-t border-white/[0.06] px-4 py-3 text-[11px] leading-relaxed text-white/24">
            Crash Detective is read-only. It checks up to {report.lookbackDays} days of Windows Application Error and Application Hang records and does not enable crash dumps or send diagnostic data anywhere.
          </div>
        </>
      ) : (
        !loading ? (
          <div className="p-4 text-xs leading-relaxed text-white/28">
            Run the scan after a crash or hang. For the most accurate match, make sure the game's installation path is configured in GameAtlas.
          </div>
        ) : null
      )}
    </div>
  );
}
