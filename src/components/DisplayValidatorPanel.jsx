import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Gauge,
  Loader2,
  Monitor,
  RefreshCw,
  Sun,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getDisplayValidationReport,
} from "../services/displayValidator";


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


function formatRefresh(
  value
) {
  if (
    !Number.isFinite(
      value
    )
    || value <= 0
  ) {
    return "Unknown";
  }

  return `${value.toFixed(value % 1 < 0.05 ? 0 : 2)} Hz`;
}


function DisplayCard({
  display,
  isLinux,
}) {
  const hdrLabel =
    display.hdrSupported === true
      ? display.hdrEnabled
        ? "On"
        : "Available · Off"
      : display.hdrSupported === false
        ? "Not reported"
        : "Unknown";

  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white/70">
            {display.name}
          </div>
          <div className="mt-0.5 text-[10px] text-white/28">
            {display.connection}
            {display.primary
              ? " · Primary"
              : ""}
          </div>
        </div>

        <Monitor className="h-4 w-4 shrink-0 text-cyan-300/55" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-md bg-white/[0.025] px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-white/22">
            Resolution
          </div>
          <div className="mt-1 text-xs font-medium text-white/55">
            {display.width} × {display.height}
          </div>
        </div>

        <div className="rounded-md bg-white/[0.025] px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/22">
            <Gauge className="h-3 w-3" />
            Refresh rate
          </div>
          <div className="mt-1 text-xs font-medium text-white/55">
            {formatRefresh(
              display.refreshHz
            )}
          </div>
          {display.maxRefreshHzAtResolution > display.refreshHz + 1 ? (
            <div className="mt-0.5 text-[10px] text-amber-200/55">
              Up to {formatRefresh(
                display.maxRefreshHzAtResolution
              )} available
            </div>
          ) : null}
        </div>

        <div className="rounded-md bg-white/[0.025] px-3 py-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/22">
            <Sun className="h-3 w-3" />
            {isLinux
              ? "HDR"
              : "Windows HDR"}
          </div>
          <div className={`mt-1 text-xs font-medium ${display.hdrEnabled ? "text-emerald-200/65" : "text-white/55"}`}>
            {hdrLabel}
          </div>
          {display.bitsPerColorChannel ? (
            <div className="mt-0.5 text-[10px] text-white/25">
              {display.bitsPerColorChannel}-bit color channel
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


export default function DisplayValidatorPanel({
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

  const isLinux =
    report?.platform
    === "linux";

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


  async function validate() {
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
        await getDisplayValidationReport(
          game
        );

      if (
        requestId.current
        === currentRequest
      ) {
        setReport(
          next
        );
      }
    } catch (loadError) {
      if (
        requestId.current
        === currentRequest
      ) {
        setError(
          String(
            loadError
          )
        );
      }
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


  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-black/10">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
            <Monitor className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-semibold text-white/75">
              Display / HDR / Refresh-Rate Validator
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Reads the active display configuration and flags refresh-rate, HDR, multi-monitor, or per-game GPU preference concerns when available.
            </div>
            {report ? (
              <div className="mt-2 text-xs text-cyan-100/55">
                {report.summary}
                {report.gpuPreference
                  ? ` GPU preference: ${report.gpuPreference}.`
                  : ""}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={validate}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/55 hover:bg-white/[0.07] disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {report
            ? "Validate Again"
            : "Validate Display Setup"}
        </button>
      </div>

      {error ? (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-4 py-3 text-xs text-red-200/70">
          The display configuration could not be read: {error}
        </div>
      ) : null}

      {loading
      && !report ? (
        <div className="flex items-center gap-3 p-4 text-sm text-white/35">
          <Loader2 className="h-4 w-4 animate-spin" />
          Reading active resolution, refresh rate, and HDR state…
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-1 gap-3 border-b border-white/[0.06] p-4 xl:grid-cols-2">
            {report.displays.map(
              (
                display,
                index
              ) => (
                <DisplayCard
                  key={`${display.deviceName}-${index}`}
                  display={display}
                  isLinux={isLinux}
                />
              )
            )}
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

          <div className="border-t border-white/[0.06] px-4 py-3 text-[11px] leading-relaxed text-white/24">
            This validator is read-only. It does not change display, HDR, refresh-rate, or GPU settings. Supported modes reported by drivers can include options a cable or display cannot use reliably.
          </div>
        </>
      ) : (
        !loading ? (
          <div className="p-4 text-xs leading-relaxed text-white/28">
            Run the validator while the display setup you normally use for this game is connected and active.
          </div>
        ) : null
      )}
    </div>
  );
}
