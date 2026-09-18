import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  FileCog,
  Loader2,
  Package,
  RefreshCw,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getRuntimeDependencyReport,
} from "../services/runtimeDependencyDoctor";


function StatusIcon({
  severity,
  className = "mt-0.5 h-4 w-4 shrink-0",
}) {
  if (severity === "warning") {
    return (
      <AlertTriangle className={`${className} text-amber-300/85`} />
    );
  }

  if (severity === "good") {
    return (
      <CheckCircle2 className={`${className} text-emerald-300/80`} />
    );
  }

  return (
    <CircleHelp className={`${className} text-cyan-300/65`} />
  );
}


function DependencyCard({
  check,
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/10 p-3">
      <div className="flex items-start gap-2.5">
        <StatusIcon severity={check.severity} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="text-sm font-semibold text-white/68">
              {check.name}
            </div>

            {check.required ? (
              <span className="rounded-full border border-cyan-300/15 bg-cyan-400/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-100/45">
                Executable evidence
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/22">
            {check.category}
            {check.architecture
              ? ` · ${check.architecture}`
              : ""}
            {check.version
              ? ` · ${check.version}`
              : ""}
          </div>

          <div className="mt-2 text-xs leading-relaxed text-white/34">
            {check.detail}
          </div>

          {check.evidence.length > 0 ? (
            <div className="mt-2 break-all font-mono text-[10px] leading-relaxed text-white/24">
              Evidence: {check.evidence.join(
                ", "
              )}
            </div>
          ) : null}

          {check.suggestion ? (
            <div className="mt-2 text-xs leading-relaxed text-cyan-100/48">
              Suggested: {check.suggestion}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


export default function RuntimeDependencyDoctorPanel({
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


  async function diagnose() {
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
        await getRuntimeDependencyReport(
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
            <FileCog className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-semibold text-white/75">
              Runtime and Dependency Doctor
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Checks the selected executable's architecture and known runtime imports against Windows, local game files, and bundled redistributables.
            </div>

            {report ? (
              <div className={`mt-2 text-xs ${report.findings.some((item) => item.severity === "warning") ? "text-amber-200/70" : "text-emerald-200/60"}`}>
                {report.summary} Inspected {report.executableName ?? "the selected executable"}
                {report.architecture
                  ? ` (${report.architecture})`
                  : ""}.
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={diagnose}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/55 hover:bg-white/[0.07] disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {report
            ? "Diagnose Again"
            : "Check Runtimes"}
        </button>
      </div>

      {error ? (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-4 py-3 text-xs text-red-200/70">
          Runtime and Dependency Doctor could not complete the check: {error}
        </div>
      ) : null}

      {loading
      && !report ? (
        <div className="flex items-center gap-3 p-4 text-sm text-white/35">
          <Loader2 className="h-4 w-4 animate-spin" />
          Inspecting executable imports and Windows runtimes…
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-1 gap-3 border-b border-white/[0.06] p-4 xl:grid-cols-2">
            {report.checks.map(
              (check) => (
                <DependencyCard
                  key={check.id}
                  check={check}
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
                  <StatusIcon severity={finding.severity} />
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

          {report.bundledInstallers.length > 0 ? (
            <details className="border-t border-white/[0.06] p-4">
              <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-white/58">
                <Package className="h-4 w-4 text-blue-300/55" />
                Bundled prerequisite installers ({report.bundledInstallers.length})
              </summary>

              <div className="mt-3 space-y-1.5">
                {report.bundledInstallers.map(
                  (path) => (
                    <div
                      key={path}
                      className="break-all rounded-md bg-white/[0.025] px-3 py-2 font-mono text-[10px] text-white/32"
                    >
                      {path}
                    </div>
                  )
                )}
              </div>
            </details>
          ) : null}

          <div className="border-t border-white/[0.06] px-4 py-3 text-[11px] leading-relaxed text-white/24">
            This check is read-only and deliberately conservative. It inspects known imports in the primary executable; dependencies loaded later by plug-ins, scripts, anti-cheat, or secondary game DLLs may not be visible. {report.scanLimited ? "The bundled-installer search reached its safety limit." : ""}
          </div>
        </>
      ) : (
        !loading ? (
          <div className="p-4 text-xs leading-relaxed text-white/28">
            Run this after a missing-DLL message, an immediate launch failure, or a clean Windows installation. No runtimes will be installed or repaired automatically.
          </div>
        ) : null
      )}
    </div>
  );
}
