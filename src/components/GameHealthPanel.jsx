import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FolderOpen,
  HeartPulse,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  runGameHealthCheck,
  summarizeGameHealth,
} from "../services/gameHealth";

import {
  storeInstallationHealth,
} from "../services/installationHealth";

import {
  openGamePath,
} from "../services/pathActions";

import {
  createSaveBackup,
} from "../services/saveBackups";


const GROUPS = [
  {
    severity: "attention",
    label: "Needs attention",
    description: "Conditions likely to affect launching, stability, or performance.",
    className: "border-red-400/15 bg-red-400/[0.035]",
    open: true,
  },
  {
    severity: "recommendation",
    label: "Recommended",
    description: "Useful follow-up steps that are not confirmed problems.",
    className: "border-amber-400/15 bg-amber-400/[0.03]",
    open: true,
  },
  {
    severity: "good",
    label: "Looks good",
    description: "Checks that passed successfully.",
    className: "border-emerald-400/12 bg-emerald-400/[0.025]",
    open: false,
  },
  {
    severity: "information",
    label: "Information",
    description: "Context that may help with troubleshooting without indicating a problem.",
    className: "border-cyan-400/10 bg-cyan-400/[0.02]",
    open: false,
  },
  {
    severity: "unavailable",
    label: "Could not check",
    description: "Checks that did not return a usable result.",
    className: "border-white/[0.08] bg-white/[0.018]",
    open: false,
  },
];


function statusText(status) {
  switch (status) {
    case "attention":
      return "Needs attention";
    case "recommendation":
      return "Recommendations available";
    case "good":
      return "Looks good";
    default:
      return "Check incomplete";
  }
}


function scanStatusText(status) {
  switch (status) {
    case "complete":
      return "Complete";
    case "unsupported":
      return "Not supported";
    case "failed":
      return "Could not check";
    default:
      return "Pending";
  }
}


function scanStatusClassName(status) {
  switch (status) {
    case "complete":
      return "text-emerald-200/65";
    case "failed":
      return "text-red-200/65";
    default:
      return "text-white/35";
  }
}


function openDiagnostic(
  scan
) {
  const sectionIds =
    scan?.sectionIds
    ?? [];

  sectionIds.forEach(
    (
      id,
      index
    ) => {
      window.setTimeout(
        () => {
          window.dispatchEvent(
            new CustomEvent(
              "game-manager-open-section",
              {
                detail: {
                  id,
                },
              }
            )
          );
        },
        index
        * 90
      );
    }
  );

  window.setTimeout(
    () => {
      document
        .getElementById(
          scan?.targetId
        )
        ?.scrollIntoView({
          behavior:
            "smooth",
          block:
            "start",
        });
    },
    sectionIds.length
    * 90
    + 80
  );
}


function ScanCard({
  scan,
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-black/35 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-white/58">
          {scan.label}
        </div>
        <div className={`mt-0.5 text-[10px] ${scanStatusClassName(scan.status)}`}>
          {scanStatusText(
            scan.status
          )}
        </div>
      </div>

      {scan.targetId ? (
        <button
          type="button"
          onClick={
            () =>
              openDiagnostic(
                scan
              )
          }
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[10px] font-semibold text-white/38 hover:bg-white/[0.06] hover:text-white/65"
        >
          View
          <ExternalLink className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}


function statusClassName(status) {
  switch (status) {
    case "attention":
      return "border-red-400/20 bg-red-400/[0.07] text-red-100/80";
    case "recommendation":
      return "border-amber-400/20 bg-amber-400/[0.07] text-amber-100/80";
    case "good":
      return "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100/80";
    default:
      return "border-white/10 bg-white/[0.035] text-white/55";
  }
}


function FindingIcon({ severity }) {
  if (severity === "attention") {
    return <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-300/85" />;
  }

  if (severity === "recommendation") {
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" />;
  }

  if (severity === "good") {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/75" />;
  }

  return <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300/55" />;
}


function FindingRow({
  item,
  actionBusy,
  onAction,
}) {
  return (
    <div className="flex items-start gap-3 border-b border-white/[0.05] px-4 py-3.5 last:border-b-0">
      <FindingIcon severity={item.severity} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white/72">
              {item.title}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/24">
              {item.source}
            </div>
            <div className="mt-1.5 break-words text-xs leading-relaxed text-white/38">
              {item.detail}
            </div>
            {item.suggestion ? (
              <div className="mt-2 text-xs leading-relaxed text-cyan-100/55">
                Suggested: {item.suggestion}
              </div>
            ) : null}
          </div>

          {item.action ? (
            <button
              type="button"
              onClick={() => onAction(item)}
              disabled={actionBusy === item.id}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-[11px] font-semibold text-white/60 hover:bg-white/[0.07] hover:text-white/80 disabled:opacity-40"
            >
              {actionBusy === item.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : item.action.type === "create-save-backup" ? (
                <Save className="h-3.5 w-3.5" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )}
              {item.action.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}


function ResultGroup({
  group,
  findings,
  actionBusy,
  onAction,
}) {
  if (findings.length === 0) {
    return null;
  }

  const heading = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-white/72">
          {group.label}
        </div>
        <div className="mt-0.5 text-xs leading-relaxed text-white/30">
          {group.description}
        </div>
      </div>
      <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-semibold text-white/45">
        {findings.length}
      </span>
    </div>
  );

  const content = (
    <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06] bg-black/10">
      {findings.map((item) => (
        <FindingRow
          key={item.id}
          item={item}
          actionBusy={actionBusy}
          onAction={onAction}
        />
      ))}
    </div>
  );

  return (
    <section className={`rounded-xl border p-4 ${group.className}`}>
      {group.open ? (
        <>
          {heading}
          {content}
        </>
      ) : (
        <details>
          <summary className="cursor-pointer list-none">
            {heading}
          </summary>
          {content}
        </details>
      )}
    </section>
  );
}


function healthRecordFromReport(report) {
  return {
    score: report.score,
    passed: report.counts.good,
    warnings: report.counts.attention,
    informational: report.counts.information + report.counts.unavailable,
    actionable: report.findings.filter((item) => Boolean(item.action)).length,
  };
}


export default function GameHealthPanel({
  game,
  isWindows = true,
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [actionBusy, setActionBusy] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  useEffect(() => {
    setReport(null);
    setError(null);
    setProgress(null);
    setActionMessage(null);
  }, [game?.id, game?.installPath]);

  async function runCheck() {
    setLoading(true);
    setError(null);
    setActionMessage(null);

    try {
      const next = await runGameHealthCheck(game, {
        includeWindows: isWindows,
        onProgress: setProgress,
      });

      setReport(next);
      storeInstallationHealth(game, healthRecordFromReport(next));
    } catch (checkError) {
      setError(String(checkError));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function handleAction(item) {
    if (!item.action) {
      return;
    }

    setActionBusy(item.id);
    setActionMessage(null);

    try {
      if (item.action.type === "open-path") {
        await openGamePath(item.action.path, game.installPath);
        return;
      }

      if (item.action.type === "create-save-backup") {
        await createSaveBackup(game);

        setReport((current) => {
          if (!current) {
            return current;
          }

          const findings = current.findings.map((findingItem) =>
            findingItem.id === item.id
              ? {
                  ...findingItem,
                  severity: "good",
                  title: "Save backup is available",
                  detail: "A GameAtlas save backup was created successfully.",
                  suggestion: null,
                  action: null,
                }
              : findingItem
          );

          const next = {
            ...current,
            findings,
            ...summarizeGameHealth(findings),
          };

          storeInstallationHealth(game, healthRecordFromReport(next));
          return next;
        });

        setActionMessage("Save backup created successfully.");
      }
    } catch (actionError) {
      setActionMessage(`Action failed: ${String(actionError)}`);
    } finally {
      setActionBusy(null);
    }
  }

  const groupedFindings = useMemo(
    () => Object.fromEntries(
      GROUPS.map((group) => [
        group.severity,
        report?.findings.filter((item) => item.severity === group.severity) ?? [],
      ])
    ),
    [report]
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/10">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
              <HeartPulse className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-white/78">
                  Diagnostics Center
                </div>
                {report ? (
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClassName(report.status)}`}>
                    {statusText(report.status)}
                  </span>
                ) : null}
              </div>

              <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
                {isWindows
                  ? "Runs installation, performance, driver, display, crash, runtime, game-configuration, background-app, and controller checks, then puts the most useful next steps first."
                  : "Checks installation and save-protection readiness, then puts the most useful next steps first."}
              </div>
              <div className="mt-2 text-[11px] text-white/24">
                Nothing runs until you start the check. Detailed tools remain available in Technical &amp; Troubleshooting.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={runCheck}
            disabled={loading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] px-3.5 py-2.5 text-xs font-semibold text-cyan-100/75 hover:bg-cyan-400/[0.12] disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : report ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {loading ? "Checking…" : report ? "Run Again" : "Run Full Diagnostic"}
          </button>
        </div>

        {loading ? (
          <div className="border-t border-white/[0.06] bg-cyan-400/[0.025] px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-cyan-100/55">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {typeof progress === "string"
                ? progress
                : progress?.label
                  ?? "Preparing diagnostics…"}
            </div>
            {typeof progress === "object"
            && progress?.total ? (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-cyan-300/55 transition-all duration-300"
                  style={{
                    width:
                      `${Math.max(
                        4,
                        Math.min(
                          100,
                          (
                            progress.completed
                            / progress.total
                          )
                          * 100
                        )
                      )}%`,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {report ? (
          <div className="border-t border-white/[0.06]">
            <div className="grid grid-cols-2 gap-px bg-white/[0.05] sm:grid-cols-4">
              <div className="bg-black/40 px-4 py-3">
                <div className="text-lg font-bold text-red-200/80">{report.counts.attention}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/25">Attention</div>
              </div>
              <div className="bg-black/40 px-4 py-3">
                <div className="text-lg font-bold text-amber-200/80">{report.counts.recommendation}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/25">Recommended</div>
              </div>
              <div className="bg-black/40 px-4 py-3">
                <div className="text-lg font-bold text-emerald-200/80">{report.counts.good}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/25">Passed</div>
              </div>
              <div className="bg-black/40 px-4 py-3">
                <div className="text-lg font-bold text-white/55">{report.counts.unavailable}</div>
                <div className="text-[10px] uppercase tracking-wide text-white/25">Unavailable</div>
              </div>
            </div>

            <div className="border-t border-white/[0.05] px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-white/28">
                  Diagnostic coverage
                </div>
                <div className="text-[10px] text-white/22">
                  {report.scans.filter((scan) => scan.status === "complete").length}/{report.scans.length} completed
                </div>
              </div>
              <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.05] sm:grid-cols-2 xl:grid-cols-4">
                {report.scans.map(
                  (scan) => (
                    <ScanCard
                      key={scan.id}
                      scan={scan}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3 text-xs text-red-100/70">
          Diagnostics Center could not finish: {error}
        </div>
      ) : null}

      {actionMessage ? (
        <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.04] px-4 py-3 text-xs text-cyan-100/65">
          {actionMessage}
        </div>
      ) : null}

      {report ? (
        <div className="space-y-3">
          {GROUPS.map((group) => (
            <ResultGroup
              key={group.severity}
              group={group}
              findings={groupedFindings[group.severity]}
              actionBusy={actionBusy}
              onAction={handleAction}
            />
          ))}
          <div className="px-1 text-[11px] leading-relaxed text-white/24">
            Diagnostics Center reports observable conditions and likely contributors. It does not claim that every running app or configuration difference is a confirmed problem.
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.018] px-4 py-5 text-center">
          <HeartPulse className="mx-auto h-5 w-5 text-white/20" />
          <div className="mt-2 text-sm font-medium text-white/45">
            No full diagnostic has been run for this game.
          </div>
          <div className="mt-1 text-xs text-white/25">
            Start the check when you want a current, prioritized assessment.
          </div>
        </div>
      )}
    </div>
  );
}
