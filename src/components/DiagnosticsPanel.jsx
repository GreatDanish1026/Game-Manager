import {
  Check,
  ClipboardCopy,
  Download,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  error as logError,
} from "../services/logging";

import {
  collectDiagnostics,
  createDiagnosticsSupportBundle,
  diagnosticsToText,
  exportDiagnosticsText,
} from "../services/diagnostics";


function formatBytes(
  bytes
) {
  const value =
    Number(
      bytes
    ) || 0;

  if (value < 1024) {
    return `${value} B`;
  }

  const units = [
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  let next =
    value / 1024;

  let unitIndex =
    0;

  while (
    next >= 1024
    && unitIndex <
      units.length - 1
  ) {
    next /=
      1024;

    unitIndex +=
      1;
  }

  return `${next.toFixed(
    1
  )} ${units[unitIndex]}`;
}


function DiagnosticRow({
  label,
  value,
}) {
  return (
    <div
      className="
        flex
        items-start
        justify-between
        gap-4
        border-b
        border-white/[0.05]
        py-2.5
        last:border-b-0
      "
    >
      <span
        className="
          text-xs
          text-white/35
        "
      >
        {label}
      </span>

      <span
        className="
          max-w-[65%]
          break-words
          text-right
          text-xs
          font-medium
          text-white/65
        "
      >
        {value
        ?? "Unknown"}
      </span>
    </div>
  );
}


function DiagnosticGroup({
  title,
  children,
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-white/[0.07]
        bg-black/10
        p-4
      "
    >
      <div
        className="
          mb-2
          text-[10px]
          font-semibold
          uppercase
          tracking-wide
          text-white/25
        "
      >
        {title}
      </div>

      {children}
    </div>
  );
}


export default function DiagnosticsPanel({
  games,
  networkOnline,
  updateCheckStatus,
}) {
  const [
    diagnostics,
    setDiagnostics,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    copied,
    setCopied,
  ] =
    useState(false);

  const [
    exportPath,
    setExportPath,
  ] =
    useState(null);

  const [
    supportBundlePath,
    setSupportBundlePath,
  ] =
    useState(null);

  const [
    creatingBundle,
    setCreatingBundle,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);


  async function refresh() {
    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const next =
        await collectDiagnostics({
          games,
          networkOnline,
          updateCheckStatus,
        });

      setDiagnostics(
        next
      );
    } catch (refreshError) {
      logError(
        "[Diagnostics] Collection failed:",
        refreshError
      );

      setError(
        String(
          refreshError
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
      refresh();
    },
    []
  );


  const text =
    useMemo(
      () =>
        diagnostics
          ? diagnosticsToText(
              diagnostics
            )
          : "",
      [
        diagnostics,
      ]
    );


  async function copyDiagnostics() {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard
        .writeText(
          text
        );

      setCopied(
        true
      );

      window.setTimeout(
        () =>
          setCopied(
            false
          ),
        2200
      );
    } catch (copyError) {
      setError(
        `Could not copy diagnostics: ${String(
          copyError
        )}`
      );
    }
  }


  async function exportDiagnostics() {
    if (!text) {
      return;
    }

    setError(
      null
    );

    try {
      const path =
        await exportDiagnosticsText(
          text
        );

      setExportPath(
        path
      );
    } catch (exportError) {
      setError(
        `Could not export diagnostics: ${String(
          exportError
        )}`
      );
    }
  }


  async function createSupportBundle() {
    if (!diagnostics) {
      return;
    }

    setCreatingBundle(
      true
    );

    setError(
      null
    );

    setSupportBundlePath(
      null
    );

    try {
      const path =
        await createDiagnosticsSupportBundle(
          diagnostics
        );

      setSupportBundlePath(
        path
      );
    } catch (bundleError) {
      logError(
        "[Diagnostics] Support bundle failed:",
        bundleError
      );

      setError(
        `Could not create support bundle: ${String(
          bundleError
        )}`
      );
    } finally {
      setCreatingBundle(
        false
      );
    }
  }


  if (
    loading
    && !diagnostics
  ) {
    return (
      <div
        className="
          flex
          items-center
          gap-3
          rounded-xl
          border
          border-white/[0.07]
          bg-black/10
          px-4
          py-5
          text-sm
          text-white/40
        "
      >
        <LoaderCircle
          className="
            h-4
            w-4
            animate-spin
          "
        />

        Collecting diagnostics…
      </div>
    );
  }


  const hardware =
    diagnostics
      ?.hardware;

  const analysis =
    diagnostics
      ?.library
      ?.analysis;

  const health =
    diagnostics
      ?.library
      ?.installationHealth;


  return (
    <div
      className="
        space-y-4
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          rounded-xl
          border
          border-cyan-500/10
          bg-cyan-500/[0.025]
          p-4
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <div
          className="
            flex
            items-start
            gap-3
          "
        >
          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-cyan-500/10
              text-cyan-300
            "
          >
            <Stethoscope
              className="
                h-4
                w-4
              "
            />
          </div>

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white/75
              "
            >
              Support Diagnostics
            </div>

            <div
              className="
                mt-1
                max-w-2xl
                text-xs
                leading-relaxed
                text-white/35
              "
            >
              Collects application, system, launcher, service, analysis, and backup status. A sanitized ZIP support bundle can be generated without including personal game paths or signing secrets.
            </div>
          </div>
        </div>

        <div
          className="
            grid
            grid-cols-1
            gap-2
            sm:flex
            sm:flex-wrap
          "
        >
          <button
            type="button"
            onClick={
              refresh
            }
            disabled={
              loading
            }
            className="
              inline-flex
              w-full
              items-center
              justify-center
              gap-2
              sm:w-auto
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.025]
              px-3
              py-2
              text-xs
              font-semibold
              text-white/50
              transition
              hover:bg-white/[0.06]
              hover:text-white/75
              disabled:opacity-30
            "
          >
            <RefreshCcw
              className={`
                h-3.5
                w-3.5
                ${
                  loading
                    ? "animate-spin"
                    : ""
                }
              `}
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={
              copyDiagnostics
            }
            disabled={
              !diagnostics
            }
            className="
              inline-flex
              w-full
              items-center
              justify-center
              gap-2
              sm:w-auto
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.025]
              px-3
              py-2
              text-xs
              font-semibold
              text-white/50
              transition
              hover:bg-white/[0.06]
              hover:text-white/75
              disabled:opacity-30
            "
          >
            {copied ? (
              <Check
                className="
                  h-3.5
                  w-3.5
                  text-emerald-300
                "
              />
            ) : (
              <ClipboardCopy
                className="
                  h-3.5
                  w-3.5
                "
              />
            )}

            {copied
              ? "Copied"
              : "Copy Diagnostics"}
          </button>

          <button
            type="button"
            onClick={
              createSupportBundle
            }
            disabled={
              !diagnostics
              || creatingBundle
            }
            className="
              inline-flex
              w-full
              items-center
              justify-center
              gap-2
              sm:w-auto
              rounded-lg
              border
              border-emerald-500/20
              bg-emerald-500/[0.06]
              px-3
              py-2
              text-xs
              font-semibold
              text-emerald-200/70
              transition
              hover:bg-emerald-500/[0.10]
              hover:text-emerald-100
              disabled:opacity-30
            "
          >
            {creatingBundle ? (
              <LoaderCircle
                className="
                  h-3.5
                  w-3.5
                  animate-spin
                "
              />
            ) : (
              <Download
                className="
                  h-3.5
                  w-3.5
                "
              />
            )}

            {creatingBundle
              ? "Creating Bundle…"
              : "Support Bundle"}
          </button>

          <button
            type="button"
            onClick={
              exportDiagnostics
            }
            disabled={
              !diagnostics
            }
            className="
              inline-flex
              w-full
              items-center
              justify-center
              gap-2
              sm:w-auto
              rounded-lg
              border
              border-cyan-500/20
              bg-cyan-500/[0.06]
              px-3
              py-2
              text-xs
              font-semibold
              text-cyan-200/70
              transition
              hover:bg-cyan-500/[0.10]
              hover:text-cyan-100
              disabled:opacity-30
            "
          >
            <Download
              className="
                h-3.5
                w-3.5
              "
            />

            Export Text
          </button>
        </div>
      </div>


      {error ? (
        <div
          className="
            rounded-xl
            border
            border-red-500/15
            bg-red-500/[0.04]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-red-200/70
          "
        >
          {error}
        </div>
      ) : null}


      {exportPath ? (
        <div
          className="
            rounded-xl
            border
            border-emerald-500/15
            bg-emerald-500/[0.04]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-emerald-200/65
          "
        >
          Diagnostics exported to: {exportPath}
        </div>
      ) : null}


      {supportBundlePath ? (
        <div
          className="
            rounded-xl
            border
            border-emerald-500/15
            bg-emerald-500/[0.04]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-emerald-200/65
          "
        >
          Support bundle created at: {supportBundlePath}
        </div>
      ) : null}


      {diagnostics ? (
        <>
          <div
            className="
              grid
              grid-cols-1
              gap-3
              xl:grid-cols-2
            "
          >
            <DiagnosticGroup
              title="Application"
            >
              <DiagnosticRow
                label="Application"
                value={
                  diagnostics.app
                    ?.name
                }
              />

              <DiagnosticRow
                label="Version"
                value={
                  diagnostics.app
                    ?.version
                }
              />

              <DiagnosticRow
                label="Network"
                value={
                  diagnostics
                    .connectivity
                    ?.online
                    ? "Online"
                    : "Offline"
                }
              />

              <DiagnosticRow
                label="Installed games"
                value={
                  diagnostics.library
                    ?.installedGames
                }
              />

              <DiagnosticRow
                label="Saved views"
                value={
                  diagnostics.library
                    ?.savedViews
                }
              />
            </DiagnosticGroup>


            <DiagnosticGroup
              title="System"
            >
              <DiagnosticRow
                label="Operating System"
                value={
                  hardware
                    ? `${hardware.os} ${hardware.osVersion}`
                    : "Unavailable"
                }
              />

              <DiagnosticRow
                label="CPU"
                value={
                  hardware
                    ?.cpu
                  ?? "Unavailable"
                }
              />

              <DiagnosticRow
                label="RAM"
                value={
                  hardware
                    ?.ramBytes
                    ? formatBytes(
                        hardware.ramBytes
                      )
                    : "Unavailable"
                }
              />

              {(
                hardware?.gpus
                ?? []
              ).map(
                (
                  gpu,
                  index
                ) => (
                  <DiagnosticRow
                    key={
                      `${gpu.name}-${index}`
                    }
                    label={
                      `GPU ${index + 1}`
                    }
                    value={
                      `${gpu.name}${
                        gpu.memoryBytes
                          ? ` · ${formatBytes(
                              gpu.memoryBytes
                            )}`
                          : ""
                      }`
                    }
                  />
                )
              )}
            </DiagnosticGroup>


            <DiagnosticGroup
              title="Library Analysis"
            >
              <DiagnosticRow
                label="Coverage"
                value={
                  `${analysis
                    ?.coverage
                    ?? 0}%`
                }
              />

              <DiagnosticRow
                label="Fully analyzed"
                value={
                  analysis?.full
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Partial"
                value={
                  analysis?.partial
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Stale"
                value={
                  analysis?.stale
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Never analyzed"
                value={
                  analysis?.never
                  ?? 0
                }
              />
            </DiagnosticGroup>


            <DiagnosticGroup
              title="Installation Health"
            >
              <DiagnosticRow
                label="Assessed"
                value={
                  health?.assessed
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Excellent"
                value={
                  health?.excellent
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Good"
                value={
                  health?.good
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Needs Attention"
                value={
                  health
                    ?.needsAttention
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Incomplete"
                value={
                  health?.incomplete
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Not Assessed"
                value={
                  health?.unassessed
                  ?? 0
                }
              />
            </DiagnosticGroup>


            <DiagnosticGroup
              title="Launchers"
            >
              {(diagnostics.launchers ?? []).length === 0 ? (
                <div className="py-2 text-xs text-white/30">
                  No launcher status is available yet.
                </div>
              ) : null}

              {(
                diagnostics.launchers
                ?? []
              ).map(
                (launcher) => (
                  <DiagnosticRow
                    key={
                      launcher.id
                    }
                    label={
                      launcher.label
                    }
                    value={
                      launcher.installed
                        ? "Available"
                        : "Not Detected"
                    }
                  />
                )
              )}
            </DiagnosticGroup>


            <DiagnosticGroup
              title="External Services"
            >
              {(diagnostics.externalServices ?? []).length === 0 ? (
                <div className="py-2 text-xs text-white/30">
                  No service status has been recorded yet.
                </div>
              ) : null}

              {(
                diagnostics
                  .externalServices
                ?? []
              ).map(
                (service) => (
                  <DiagnosticRow
                    key={
                      service.id
                    }
                    label={
                      service.label
                    }
                    value={
                      service.status
                    }
                  />
                )
              )}
            </DiagnosticGroup>


            <DiagnosticGroup
              title="Backup Storage"
            >
              <DiagnosticRow
                label="Game folders"
                value={
                  diagnostics
                    .backupStorage
                    ?.gameDirectoryCount
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Backup count"
                value={
                  diagnostics
                    .backupStorage
                    ?.backupCount
                  ?? 0
                }
              />

              <DiagnosticRow
                label="Storage used"
                value={
                  formatBytes(
                    diagnostics
                      .backupStorage
                      ?.totalSizeBytes
                    ?? 0
                  )
                }
              />
            </DiagnosticGroup>


            <DiagnosticGroup
              title="Privacy"
            >
              <div
                className="
                  flex
                  items-start
                  gap-3
                  py-2
                "
              >
                <ShieldCheck
                  className="
                    mt-0.5
                    h-4
                    w-4
                    shrink-0
                    text-emerald-300/70
                  "
                />

                <div
                  className="
                    text-xs
                    leading-relaxed
                    text-white/38
                  "
                >
                  Exported diagnostics and support bundles omit game installation paths, save paths, backup filenames, tags, saved-view names, account identifiers, and updater signing material. Persistent application logs are included only when a GameAtlas log directory already exists.
                </div>
              </div>
            </DiagnosticGroup>
          </div>


          <details
            className="
              rounded-xl
              border
              border-white/[0.07]
              bg-black/10
            "
          >
            <summary
              className="
                cursor-pointer
                px-4
                py-3
                text-xs
                font-semibold
                text-white/45
              "
            >
              Preview diagnostic text
            </summary>

            <pre
              className="
                max-h-[420px]
                overflow-auto
                whitespace-pre-wrap
                border-t
                border-white/[0.06]
                p-4
                text-[10px]
                leading-relaxed
                text-white/35
              "
            >
              {text}
            </pre>
          </details>
        </>
      ) : null}
    </div>
  );
}
