import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleHelp,
  FileCheck2,
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Settings2,
  Undo2,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createConfigurationBackup,
  getConfigurationBackupStatus,
  getConfigurationValidationReport,
  restoreConfigurationBackup,
  safelyResetConfiguration,
} from "../services/configurationValidator";

import {
  openGamePath,
} from "../services/pathActions";


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


function formatBytes(
  value
) {
  if (!Number.isFinite(value)) {
    return "Unknown size";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}


function IssueCard({
  item,
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/10 p-3">
      <div className="flex items-start gap-2.5">
        <StatusIcon severity={item.severity} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="text-sm font-semibold text-white/68">
              {item.title}
            </div>

            {item.fileName ? (
              <span className="max-w-full truncate rounded-full border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 font-mono text-[9px] text-white/30">
                {item.fileName}
                {item.line
                  ? ` · line ${item.line}`
                  : ""}
              </span>
            ) : null}
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
  );
}


function formatBackupDate(
  unix
) {
  if (!Number.isFinite(unix)) {
    return "Unknown date";
  }

  return new Date(
    unix
    * 1000
  ).toLocaleString();
}


function ConfigurationRecovery({
  game,
  report,
  onConfigurationChanged,
}) {
  const [
    status,
    setStatus,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    busy,
    setBusy,
  ] =
    useState(null);

  const [
    error,
    setError,
  ] =
    useState(null);

  const [
    message,
    setMessage,
  ] =
    useState(null);

  const [
    confirmation,
    setConfirmation,
  ] =
    useState(null);


  async function refresh() {
    setLoading(
      true
    );

    try {
      setStatus(
        await getConfigurationBackupStatus(
          game
        )
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


  useEffect(
    () => {
      if (report) {
        refresh();
      }
    },
    [
      report,
      game?.id,
    ]
  );


  async function runAction(
    type,
    backupId = null
  ) {
    setBusy(
      type
    );
    setError(
      null
    );
    setMessage(
      null
    );

    try {
      let result;

      if (type === "backup") {
        result =
          await createConfigurationBackup(
            game
          );
      } else if (type === "reset") {
        result =
          await safelyResetConfiguration(
            game
          );
      } else {
        result =
          await restoreConfigurationBackup(
            game,
            backupId
          );
      }

      setMessage(
        result.message
      );
      setConfirmation(
        null
      );
      await refresh();

      if (
        type === "reset"
        || type === "restore"
      ) {
        await onConfigurationChanged();
      }
    } catch (actionError) {
      setError(
        String(
          actionError
        )
      );
    } finally {
      setBusy(
        null
      );
    }
  }


  const actionsDisabled =
    Boolean(
      busy
    )
    || status?.gameRunning;


  return (
    <div className="border-t border-white/[0.06] bg-violet-400/[0.018] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/[0.08] text-violet-200/65">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>

          <div>
            <div className="text-sm font-semibold text-white/68">
              Configuration Backup &amp; Safe Reset
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/32">
              Create verified backups, rename current settings so the game can generate clean defaults, or restore an earlier configuration.
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {status?.backups?.length > 0 ? (
            <button
              type="button"
              onClick={
                () =>
                  openGamePath(
                    status.backupDirectory,
                    null
                  )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-semibold text-white/48 hover:bg-white/[0.06]"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Backup Folder
            </button>
          ) : null}

          <button
            type="button"
            onClick={
              () =>
                runAction(
                  "backup"
                )
            }
            disabled={actionsDisabled || report.filesInspected === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-300/15 bg-violet-400/[0.055] px-3 py-2 text-xs font-semibold text-violet-100/60 hover:bg-violet-400/[0.1] disabled:opacity-35"
          >
            {busy === "backup" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            Create Backup
          </button>

          <button
            type="button"
            onClick={
              () =>
                setConfirmation({
                  type:
                    "reset",
                })
            }
            disabled={actionsDisabled || report.filesInspected === 0 || report.usedInstallFallback}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300/15 bg-amber-400/[0.045] px-3 py-2 text-xs font-semibold text-amber-100/60 hover:bg-amber-400/[0.09] disabled:opacity-35"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Safe Reset
          </button>
        </div>
      </div>

      {loading
      && !status ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-white/28">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading recovery history…
        </div>
      ) : null}

      {status?.gameRunning ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.045] px-3 py-2.5 text-xs leading-relaxed text-amber-100/60">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Close {status.executableName ?? "the game"} before using backup or recovery actions. This prevents the game from rewriting files during the operation.
        </div>
      ) : null}

      {report.usedInstallFallback ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.025] px-3 py-2.5 text-xs leading-relaxed text-cyan-100/45">
          <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Safe Reset is unavailable because GameAtlas is using install-folder guesses instead of a resolved configuration folder. You can still create a verified backup.
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 py-2.5 text-xs leading-relaxed text-red-100/65">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.035] px-3 py-2.5 text-xs leading-relaxed text-emerald-100/60">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {message}
        </div>
      ) : null}

      {confirmation?.type === "reset" ? (
        <div className="mt-3 rounded-lg border border-amber-300/15 bg-amber-400/[0.04] p-3">
          <div className="text-xs font-semibold text-amber-100/72">
            Reset {report.filesInspected} configuration file{report.filesInspected === 1 ? "" : "s"}?
          </div>
          <div className="mt-1 text-xs leading-relaxed text-white/35">
            GameAtlas will create and verify a safety backup first, then rename the current files. Nothing is deleted. The game should create fresh defaults the next time it starts.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={
                () =>
                  runAction(
                    "reset"
                  )
              }
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-400/[0.09] px-3 py-2 text-xs font-semibold text-amber-100/72 disabled:opacity-40"
            >
              {busy === "reset" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Confirm Safe Reset
            </button>
            <button
              type="button"
              onClick={
                () =>
                  setConfirmation(
                    null
                  )
              }
              disabled={Boolean(busy)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/45 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {confirmation?.type === "restore" ? (
        <div className="mt-3 rounded-lg border border-cyan-300/15 bg-cyan-400/[0.035] p-3">
          <div className="text-xs font-semibold text-cyan-100/70">
            Restore the backup from {formatBackupDate(confirmation.backup.createdUnix)}?
          </div>
          <div className="mt-1 text-xs leading-relaxed text-white/35">
            Current configuration files will be backed up before the selected copy is restored and verified. Close the game before continuing.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={
                () =>
                  runAction(
                    "restore",
                    confirmation.backup.id
                  )
              }
              disabled={Boolean(busy)}
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.075] px-3 py-2 text-xs font-semibold text-cyan-100/70 disabled:opacity-40"
            >
              {busy === "restore" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              Confirm Restore
            </button>
            <button
              type="button"
              onClick={
                () =>
                  setConfirmation(
                    null
                  )
              }
              disabled={Boolean(busy)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/45 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {status?.backups?.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.07]">
          <div className="border-b border-white/[0.06] bg-black/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/28">
            Recovery history
          </div>

          {status.backups.slice(0, 6).map(
            (backup) => (
              <div
                key={backup.id}
                className="flex flex-col gap-2 border-b border-white/[0.05] px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-white/52">
                    {backup.reason}
                  </div>
                  <div className="mt-0.5 text-[10px] text-white/24">
                    {formatBackupDate(backup.createdUnix)} · {backup.fileCount} file{backup.fileCount === 1 ? "" : "s"} · {formatBytes(backup.totalSizeBytes)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    () =>
                      setConfirmation({
                        type:
                          "restore",

                        backup,
                      })
                  }
                  disabled={actionsDisabled}
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.025] px-2.5 py-1.5 text-[10px] font-semibold text-white/48 hover:bg-white/[0.06] disabled:opacity-35"
                >
                  <Undo2 className="h-3 w-3" />
                  Restore
                </button>
              </div>
            )
          )}
        </div>
      ) : status ? (
        <div className="mt-3 text-xs text-white/25">
          No configuration backups have been created for this game yet.
        </div>
      ) : null}
    </div>
  );
}


export default function ConfigurationValidatorPanel({
  game,
  isLinux = false,
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
      game?.technical
        ?.configLocation,
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
        await getConfigurationValidationReport(
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


  const warningCount =
    report?.issues
      ?.filter(
        (item) =>
          item.severity
          === "warning"
      )
      .length
    ?? 0;


  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-black/10">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <FileCheck2 className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-semibold text-white/75">
              Game Configuration Validator
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Checks {isLinux ? "native Linux or Proton" : "local"} settings files for damaged JSON, XML, or INI structure, duplicate INI values, read-only files, and implausible graphics or display settings.
            </div>

            {report ? (
              <div className={`mt-2 text-xs ${warningCount > 0 ? "text-amber-200/70" : "text-emerald-200/60"}`}>
                {report.summary}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {report?.configPath ? (
            <button
              type="button"
              onClick={
                () =>
                  openGamePath(
                    report.configPath,
                    game?.installPath
                  )
              }
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-semibold text-white/50 hover:bg-white/[0.06]"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open Config Folder
            </button>
          ) : null}

          <button
            type="button"
            onClick={validate}
            disabled={loading || !game?.installPath}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300/15 bg-violet-400/[0.06] px-3 py-2 text-xs font-semibold text-violet-100/65 hover:bg-violet-400/[0.11] disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {report
              ? "Validate Again"
              : "Validate Configuration"}
          </button>
        </div>
      </div>

      {!game?.installPath ? (
        <div className="border-b border-amber-500/10 bg-amber-500/[0.035] px-4 py-3 text-xs text-amber-100/55">
          A local installation is required before GameAtlas can inspect configuration files.
        </div>
      ) : null}

      {error ? (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-4 py-3 text-xs text-red-200/70">
          Game Configuration Validator could not complete the check: {error}
        </div>
      ) : null}

      {loading
      && !report ? (
        <div className="flex items-center gap-3 p-4 text-sm text-white/35">
          <Loader2 className="h-4 w-4 animate-spin" />
          Resolving and validating local configuration files…
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-2 gap-3 border-b border-white/[0.06] p-4 lg:grid-cols-4">
            <div className="rounded-lg border border-white/[0.07] bg-black/15 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/24">
                Files checked
              </div>
              <div className="mt-1 text-xl font-bold text-white/72">
                {report.filesInspected}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-black/15 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/24">
                Needs attention
              </div>
              <div className={`mt-1 text-xl font-bold ${warningCount > 0 ? "text-amber-200/80" : "text-emerald-200/75"}`}>
                {warningCount}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-black/15 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/24">
                Settings recognized
              </div>
              <div className="mt-1 text-xl font-bold text-white/72">
                {report.settings.length}
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.07] bg-black/15 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/24">
                Search source
              </div>
              <div className="mt-1 text-sm font-bold text-white/65">
                {report.usedInstallFallback
                  ? "Install fallback"
                  : "Reported folder"}
              </div>
            </div>
          </div>

          {report.issues.length > 0 ? (
            <div className="border-b border-white/[0.06] p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/30">
                <AlertTriangle className="h-3.5 w-3.5" />
                Findings
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {report.issues.map(
                  (
                    item,
                    index
                  ) => (
                    <IssueCard
                      key={`${item.title}-${item.fileName ?? "general"}-${item.line ?? index}`}
                      item={item}
                    />
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 border-b border-emerald-400/10 bg-emerald-400/[0.025] p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/75" />
              <div className="text-xs leading-relaxed text-emerald-100/55">
                The recognized files were readable and no definite structural or value problems were found.
              </div>
            </div>
          )}

          {report.settings.length > 0 ? (
            <div className="border-b border-white/[0.06] p-4">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/30">
                <Settings2 className="h-3.5 w-3.5" />
                Recognized graphics settings
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {report.settings.map(
                  (
                    setting,
                    index
                  ) => (
                    <div
                      key={`${setting.source}-${setting.name}-${index}`}
                      className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white/58">
                            {setting.name}
                          </div>
                          <div className="mt-0.5 truncate font-mono text-[9px] text-white/22">
                            {setting.source}
                          </div>
                        </div>
                        <div className="shrink-0 font-mono text-xs font-semibold text-violet-100/65">
                          {setting.value}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          {report.files.length > 0 ? (
            <div className="p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/30">
                Inspected files
              </div>

              <div className="overflow-hidden rounded-lg border border-white/[0.07]">
                {report.files.map(
                  (
                    file,
                    index
                  ) => (
                    <div
                      key={`${file.relativePath}-${index}`}
                      className="flex flex-col gap-2 border-b border-white/[0.05] px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white/55">
                          {file.relativePath || file.fileName}
                        </div>
                        <div className="mt-0.5 text-[10px] text-white/22">
                          {file.format} · {formatBytes(file.sizeBytes)}
                          {file.readOnly
                            ? " · Read-only"
                            : ""}
                        </div>
                      </div>

                      <div className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${file.issueCount > 0 ? "border-amber-300/15 bg-amber-400/[0.05] text-amber-100/55" : "border-emerald-300/15 bg-emerald-400/[0.05] text-emerald-100/55"}`}>
                        {file.issueCount > 0 ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {file.issueCount > 0
                          ? `${file.issueCount} finding${file.issueCount === 1 ? "" : "s"}`
                          : "Readable"}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          <ConfigurationRecovery
            game={
              game
            }
            report={
              report
            }
            onConfigurationChanged={
              validate
            }
          />

          <div className="border-t border-white/[0.06] bg-white/[0.012] px-4 py-3 text-[10px] leading-relaxed text-white/24">
            Validation is read-only and never uploads or displays arbitrary configuration contents. Backup and recovery actions run only after your confirmation, verify copied files, and preserve a safety backup before reset or restore. A clean validation result confirms only the formats and known values GameAtlas can safely recognize.
            {report.filesSkipped > 0
              ? ` ${report.filesSkipped} file${report.filesSkipped === 1 ? " was" : "s were"} skipped for safety.`
              : ""}
            {report.scanTruncated
              ? " The file search reached its safety limit, so this result may be incomplete."
              : ""}
          </div>
        </>
      ) : null}
    </div>
  );
}
