import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  FileCode2,
  FolderOpen,
  Layers3,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getModConflictReport,
} from "../services/modConflictInspector";

import {
  openGamePath,
} from "../services/pathActions";


function StatusIcon({
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


function formatDate(
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


function FindingCard({
  item,
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/10 p-3">
      <div className="flex items-start gap-2.5">
        <StatusIcon severity={item.severity} />

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white/68">
            {item.title}
          </div>
          <div className="mt-1.5 text-xs leading-relaxed text-white/35">
            {item.detail}
          </div>

          {item.evidence?.length > 0 ? (
            <div className="mt-2 space-y-1">
              {item.evidence.map(
                (
                  entry,
                  index
                ) => (
                  <div
                    key={`${entry}-${index}`}
                    className="break-all font-mono text-[10px] text-white/28"
                  >
                    {entry}
                  </div>
                )
              )}
            </div>
          ) : null}

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


function DllRow({
  dll,
  installPath,
  onError,
}) {
  async function openLocation() {
    try {
      await openGamePath(
        dll.fullPath,
        installPath
      );
    } catch (error) {
      onError(
        String(error)
      );
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-white/[0.05] px-3 py-2.5 first:border-t-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-xs font-semibold text-white/58">
            {dll.fileName}
          </span>
          <span className="rounded-full border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 text-[9px] text-white/30">
            {dll.category}
          </span>
          {dll.architecture ? (
            <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${dll.architectureMismatch ? "border-amber-400/20 bg-amber-400/[0.07] text-amber-200/75" : "border-white/[0.07] bg-white/[0.025] text-white/30"}`}>
              {dll.architecture}
              {dll.architectureMismatch
                ? " mismatch"
                : ""}
            </span>
          ) : null}
        </div>

        <div className="mt-1 truncate font-mono text-[10px] text-white/24" title={dll.relativePath}>
          {dll.relativePath}
        </div>
        <div className="mt-1 text-[10px] text-white/20">
          {formatBytes(
            dll.sizeBytes
          )} · {formatDate(
            dll.modifiedUnix
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={openLocation}
        title="Open file location"
        className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.025] text-white/35 hover:bg-white/[0.06] hover:text-white/60"
      >
        <FolderOpen className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}


export default function ModConflictInspectorPanel({
  game,
  isLinux = false,
}) {
  const requestId =
    useRef(0);

  const [
    report,
    setReport,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState("mod");

  const [
    visibleCount,
    setVisibleCount,
  ] = useState(40);

  const [
    inventoryOpen,
    setInventoryOpen,
  ] = useState(false);


  useEffect(
    () => {
      requestId.current +=
        1;
      setReport(null);
      setLoading(false);
      setError(null);
      setQuery("");
      setFilter("mod");
      setVisibleCount(40);
      setInventoryOpen(false);
    },
    [
      game?.id,
      game?.installPath,
    ]
  );


  async function scan() {
    const currentRequest =
      requestId.current
      + 1;
    requestId.current =
      currentRequest;
    setLoading(true);
    setError(null);

    try {
      const next =
        await getModConflictReport(
          game
        );
      if (
        requestId.current
          !== currentRequest
      ) {
        return;
      }
      setReport(next);
      setInventoryOpen(
        next.findings.some(
          (item) =>
            item.severity
              === "warning"
        )
      );
    } catch (scanError) {
      if (
        requestId.current
          === currentRequest
      ) {
        setError(
          String(scanError)
        );
      }
    } finally {
      if (
        requestId.current
          === currentRequest
      ) {
        setLoading(false);
      }
    }
  }


  const filteredDlls =
    useMemo(
      () => {
        const needle =
          query
            .trim()
            .toLowerCase();

        return (
          report?.dlls
          ?? []
        ).filter(
          (dll) => {
            const matchesFilter =
              filter === "all"
              || (
                filter === "mod"
                && dll.category
                  !== "Game library"
                && dll.category
                  !== "Runtime / platform"
              )
              || (
                filter === "risk"
                && (
                  dll.architectureMismatch
                  || dll.proxyName
                )
              );

            return matchesFilter
              && (
                !needle
                || dll.fileName
                  .toLowerCase()
                  .includes(needle)
                || dll.relativePath
                  .toLowerCase()
                  .includes(needle)
                || dll.category
                  .toLowerCase()
                  .includes(needle)
              );
          }
        );
      },
      [
        report,
        query,
        filter,
      ]
    );


  return (
    <div
      id="diagnostic-mod-conflicts"
      className="mt-5 scroll-mt-20 overflow-hidden rounded-xl border border-white/[0.08] bg-black/10"
    >
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/10 text-fuchsia-300">
            <Layers3 className="h-5 w-5" />
          </div>

          <div>
            <div className="text-sm font-semibold text-white/75">
              Mod Conflict &amp; DLL Inspector
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              {isLinux
                ? "Inventories Proton DLLs, native shared libraries, and plug-ins; recognizes common mod frameworks; and checks architecture, proxy entry points, empty files, and differing duplicate mod binaries."
                : "Inventories local DLLs and plug-ins, recognizes common mod frameworks, and checks architecture, proxy entry points, empty files, and differing duplicate mod DLLs."}
            </div>
            <div className="mt-2 text-[10px] text-white/24">
              Manual and read-only. GameAtlas does not remove, replace, disable, or upload any files.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={scan}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-fuchsia-400/15 bg-fuchsia-500/[0.07] px-3 py-2 text-xs font-semibold text-fuchsia-100/65 hover:bg-fuchsia-500/[0.13] disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {loading
            ? "Inspecting…"
            : report
              ? "Scan Again"
              : isLinux
                ? "Inspect Mods & Binaries"
                : "Inspect Mods & DLLs"}
        </button>
      </div>

      {error ? (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-4 py-3 text-xs text-red-200/70">
          Mod Conflict &amp; DLL Inspector could not complete the scan: {error}
        </div>
      ) : null}

      {loading && !report ? (
        <div className="flex items-center gap-3 p-4 text-sm text-white/35">
          <Loader2 className="h-4 w-4 animate-spin text-fuchsia-300/70" />
          {isLinux
            ? "Mapping mod frameworks and inspecting local binaries…"
            : "Mapping mod frameworks and inspecting local DLLs…"}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid grid-cols-2 gap-px border-b border-white/[0.06] bg-white/[0.05] sm:grid-cols-4">
            {[
              [
                report.frameworks.length,
                "Frameworks",
              ],
              [
                report.modDllCount,
                "Mod / injector files",
              ],
              [
                report.proxyCount,
                isLinux
                  ? "Windows proxy DLLs"
                  : "Proxy DLLs",
              ],
              [
                report.dllCount,
                isLinux
                  ? "Binaries inspected"
                  : "DLLs inspected",
              ],
            ].map(
              ([
                value,
                label,
              ]) => (
                <div
                  key={label}
                  className="bg-black/35 px-4 py-3"
                >
                  <div className="text-lg font-bold text-white/65">
                    {value}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-white/25">
                    {label}
                  </div>
                </div>
              )
            )}
          </div>

          <div className="border-b border-white/[0.06] p-4">
            <div className={`text-sm font-semibold ${report.findings.some((item) => item.severity === "warning") ? "text-amber-100/70" : "text-emerald-100/65"}`}>
              {report.summary}
            </div>
            <div className="mt-1 text-[10px] text-white/24">
              Primary executable architecture: {report.executableArchitecture ?? "Unknown"} · {report.filesVisited.toLocaleString()} installation entries visited
            </div>
            <div className="mt-3 space-y-2">
              {report.findings.map(
                (
                  item,
                  index
                ) => (
                  <FindingCard
                    key={`${item.title}-${index}`}
                    item={item}
                  />
                )
              )}
            </div>
          </div>

          {report.frameworks.length > 0 ? (
            <div className="border-b border-white/[0.06] p-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-white/28">
                Detected frameworks and plug-ins
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {report.frameworks.map(
                  (framework) => (
                    <div
                      key={framework.id}
                      className="rounded-lg border border-white/[0.07] bg-white/[0.018] p-3"
                    >
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-4 w-4 text-fuchsia-300/60" />
                        <div className="text-xs font-semibold text-white/58">
                          {framework.name}
                        </div>
                      </div>
                      <div className="mt-1 text-[10px] text-white/25">
                        {framework.kind}
                      </div>
                      <div className="mt-2 truncate font-mono text-[9px] text-white/22" title={framework.evidence[0]}>
                        {framework.evidence[0]}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          {report.duplicateGroups.length > 0 ? (
            <div className="border-b border-white/[0.06] p-4">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-white/28">
                {isLinux
                  ? "Relevant duplicate mod binary names"
                  : "Relevant duplicate DLL names"}
              </div>
              <div className="space-y-2">
                {report.duplicateGroups.slice(0, 8).map(
                  (group) => (
                    <div
                      key={group.fileName}
                      className="flex flex-col gap-1 rounded-lg border border-white/[0.07] bg-white/[0.018] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-white/52">
                          {group.fileName}
                        </div>
                        <div className="mt-0.5 text-[10px] text-white/24">
                          {group.copies} copies · {group.distinctVersions} distinct fingerprint{group.distinctVersions === 1 ? "" : "s"}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${group.potentiallyConflicting ? "border-amber-400/20 bg-amber-400/[0.07] text-amber-200/70" : "border-white/[0.07] bg-white/[0.025] text-white/28"}`}>
                        {group.potentiallyConflicting
                          ? "Review"
                          : "May be intentional"}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}

          <div>
            <button
              type="button"
              onClick={
                () =>
                  setInventoryOpen(
                    (value) =>
                      !value
                  )
              }
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
            >
              <div>
                <div className="text-xs font-semibold text-white/55">
                  {isLinux
                    ? "Mod binary inventory"
                    : "DLL inventory"}
                </div>
                <div className="mt-0.5 text-[10px] text-white/23">
                  {report.dllsReturned} detailed record{report.dllsReturned === 1 ? "" : "s"} available
                </div>
              </div>
              {inventoryOpen ? (
                <ChevronUp className="h-4 w-4 text-white/30" />
              ) : (
                <ChevronDown className="h-4 w-4 text-white/30" />
              )}
            </button>

            {inventoryOpen ? (
              <div className="border-t border-white/[0.06]">
                <div className="flex flex-col gap-2 border-b border-white/[0.05] p-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/24" />
                    <input
                      value={query}
                      onChange={
                        (event) => {
                          setQuery(
                            event.target.value
                          );
                          setVisibleCount(40);
                        }
                      }
                      placeholder="Search filename or path"
                      className="w-full rounded-lg border border-white/[0.08] bg-black/20 py-2 pl-9 pr-3 text-xs text-white/60 outline-none placeholder:text-white/20 focus:border-fuchsia-400/25"
                    />
                  </div>

                  <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-black/15 p-1">
                    {[
                      [
                        "mod",
                        "Mods",
                      ],
                      [
                        "risk",
                        "Proxy & risks",
                      ],
                      [
                        "all",
                        "All",
                      ],
                    ].map(
                      ([
                        value,
                        label,
                      ]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={
                            () => {
                              setFilter(value);
                              setVisibleCount(40);
                            }
                          }
                          className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold ${filter === value ? "bg-fuchsia-500/10 text-fuchsia-100/65" : "text-white/28 hover:text-white/50"}`}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {filteredDlls.length > 0 ? (
                  <div>
                    {filteredDlls
                      .slice(
                        0,
                        visibleCount
                      )
                      .map(
                        (dll) => (
                          <DllRow
                            key={dll.fullPath}
                            dll={dll}
                            installPath={report.installPath}
                            onError={setError}
                          />
                        )
                      )}

                    {visibleCount < filteredDlls.length ? (
                      <div className="border-t border-white/[0.05] p-3 text-center">
                        <button
                          type="button"
                          onClick={
                            () =>
                              setVisibleCount(
                                (value) =>
                                  value
                                  + 40
                              )
                          }
                          className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs font-semibold text-white/42 hover:bg-white/[0.055]"
                        >
                          Show More ({filteredDlls.length - visibleCount} remaining)
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-white/28">
                    No mod binaries match the current filter.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : !loading ? (
        <div className="p-4 text-xs leading-relaxed text-white/30">
          Start a scan when you want to troubleshoot a modded game. Large installations are bounded so the inspector cannot walk the drive indefinitely.
        </div>
      ) : null}
    </div>
  );
}
