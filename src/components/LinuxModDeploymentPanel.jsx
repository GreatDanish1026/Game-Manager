import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  Folder,
  FolderInput,
  FolderOpen,
  Loader2,
  PackagePlus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  deployLinuxMod,
  getLinuxModDeploymentStatus,
  pickLinuxModSource,
  prepareLinuxStagedMod,
  removeLinuxModDeployment,
} from "../services/linuxModDeployment";

import {
  openGamePath,
} from "../services/pathActions";


function formatBytes(
  bytes
) {
  const value =
    Number(
      bytes
      ?? 0
    );

  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];
  let amount = value;
  let unit = 0;

  while (
    amount >= 1024
    && unit < units.length - 1
  ) {
    amount /= 1024;
    unit += 1;
  }

  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}


function formatDate(
  unix
) {
  const value =
    Number(
      unix
      ?? 0
    );

  if (!Number.isFinite(value) || value <= 0) {
    return "Unknown date";
  }

  return new Date(value * 1000).toLocaleString();
}


export default function LinuxModDeploymentPanel({
  game,
  isLinux = false,
}) {
  const [
    status,
    setStatus,
  ] = useState(null);
  const [
    preview,
    setPreview,
  ] = useState(null);
  const [
    modName,
    setModName,
  ] = useState("");
  const [
    loading,
    setLoading,
  ] = useState(false);
  const [
    picking,
    setPicking,
  ] = useState(false);
  const [
    deploying,
    setDeploying,
  ] = useState(false);
  const [
    preparingPath,
    setPreparingPath,
  ] = useState(null);
  const [
    removingId,
    setRemovingId,
  ] = useState(null);
  const [
    message,
    setMessage,
  ] = useState(null);
  const [
    error,
    setError,
  ] = useState(null);


  async function loadStatus() {
    if (!isLinux || !game?.installPath) {
      setStatus(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const next =
        await getLinuxModDeploymentStatus(
          game
        );
      setStatus(next);
    } catch (loadError) {
      setError(
        String(
          loadError
        )
      );
    } finally {
      setLoading(false);
    }
  }


  useEffect(
    () => {
      setPreview(null);
      setModName("");
      setMessage(null);
      setError(null);
      loadStatus();
    },
    [
      isLinux,
      game?.id,
      game?.name,
      game?.installPath,
    ]
  );


  if (!isLinux) {
    return null;
  }


  async function selectSource() {
    setPicking(true);
    setMessage(null);
    setError(null);

    try {
      const next =
        await pickLinuxModSource(
          game
        );

      if (next) {
        setPreview(next);
        setModName(
          next.suggestedName
          ?? ""
        );
      }
    } catch (pickError) {
      setError(
        String(
          pickError
        )
      );
    } finally {
      setPicking(false);
    }
  }


  async function prepareStaged(
    item
  ) {
    setPreparingPath(
      item.path
    );
    setMessage(null);
    setError(null);

    try {
      const next =
        await prepareLinuxStagedMod(
          game,
          item.path
        );
      setPreview(next);
      setModName(
        next.suggestedName
        ?? item.name
        ?? ""
      );
      if (item.kind === "zip" || item.kind === "rar") {
        setMessage(
          `The ${item.kind.toUpperCase()} archive was safely extracted. Review its deployment preview before continuing.`
        );
        await loadStatus();
      }
    } catch (prepareError) {
      setError(
        String(
          prepareError
        )
      );
    } finally {
      setPreparingPath(null);
    }
  }


  async function deploy() {
    if (!preview || !modName.trim()) {
      return;
    }

    const overwriteText =
      preview.existingFileCount > 0
        ? `\n\n${preview.existingFileCount} existing game file${preview.existingFileCount === 1 ? "" : "s"} will be backed up and replaced.`
        : "";
    const confirmed =
      window.confirm(
        `Deploy “${modName.trim()}” into this game?${overwriteText}\n\nFully exit the game before continuing.`
      );

    if (!confirmed) {
      return;
    }

    setDeploying(true);
    setMessage(null);
    setError(null);

    try {
      const result =
        await deployLinuxMod(
          game,
          preview.sourcePath,
          modName.trim()
        );
      setMessage(
        result.message
      );
      setPreview(null);
      setModName("");
      await loadStatus();
    } catch (deployError) {
      setError(
        String(
          deployError
        )
      );
    } finally {
      setDeploying(false);
    }
  }


  async function removeDeployment(
    deployment
  ) {
    const confirmed =
      window.confirm(
        `Remove “${deployment.name}”?\n\nGameAtlas will remove its deployed files and restore ${deployment.overwrittenFileCount} backed-up file${deployment.overwrittenFileCount === 1 ? "" : "s"}. Fully exit the game first.`
      );

    if (!confirmed) {
      return;
    }

    setRemovingId(
      deployment.id
    );
    setMessage(null);
    setError(null);

    try {
      const result =
        await removeLinuxModDeployment(
          game,
          deployment.id
        );
      setMessage(
        result.message
      );
      await loadStatus();
    } catch (removeError) {
      setError(
        String(
          removeError
        )
      );
    } finally {
      setRemovingId(null);
    }
  }


  async function openFolder(
    path
  ) {
    try {
      setError(null);
      await openGamePath(
        path,
        game?.installPath
      );
    } catch (openError) {
      setError(
        String(
          openError
        )
      );
    }
  }


  const busy =
    loading
    || picking
    || Boolean(
      preparingPath
    )
    || deploying
    || Boolean(
      removingId
    );


  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-black/10">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
            <PackagePlus className="h-5 w-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-white/75">
                Linux Mod Deployment Manager
              </div>
              <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.05] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200/60">
                Linux only
              </span>
            </div>

            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Drop mod folders, ZIP archives, or RAR archives into this game's VortexMods staging folder. GameAtlas can safely extract archives, preview conflicts, and create a reversible deployment.
            </div>

            {status ? (
              <div className="mt-2 text-xs text-white/28">
                {status.deployments.length} managed deployment{status.deployments.length === 1 ? "" : "s"}
                {" • "}
                Remove newest first
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {status?.stagingPath ? (
            <button
              type="button"
              onClick={() => openFolder(status.stagingPath)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/50 hover:bg-white/[0.07] disabled:opacity-35"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Open VortexMods Folder
            </button>
          ) : null}

          <button
            type="button"
            onClick={loadStatus}
            disabled={busy || !game?.installPath}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/50 hover:bg-white/[0.07] disabled:opacity-35"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={selectSource}
            disabled={busy || !game?.installPath}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.07] px-3 py-2 text-xs font-semibold text-cyan-100/75 hover:bg-cyan-400/[0.11] disabled:opacity-35"
          >
            {picking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderInput className="h-3.5 w-3.5" />
            )}
            Select Other Folder
          </button>
        </div>
      </div>


      {error ? (
        <div className="border-b border-red-500/10 bg-red-500/[0.04] px-4 py-3 text-xs leading-relaxed text-red-200/70">
          {error}
        </div>
      ) : null}


      {message ? (
        <div className="flex items-start gap-2 border-b border-emerald-500/10 bg-emerald-500/[0.035] px-4 py-3 text-xs leading-relaxed text-emerald-100/65">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {message}
        </div>
      ) : null}


      {status ? (
        <div className="border-b border-white/[0.06] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-white/30">
                Staged mods
              </div>
              <div className="mt-1 break-all font-mono text-[10px] text-white/22">
                {status.stagingPath}
              </div>
            </div>
            <div className="text-[10px] text-white/25">
              Drop a folder, .zip, or .rar here, then refresh.
            </div>
          </div>

          <div className="mt-2 text-[10px] text-white/25">
            RAR support: {status.rarSupported ? status.rarProvider : "Unavailable — install the unar package"}
          </div>

          {status.stagedItems.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {status.stagedItems.map((item) => (
                <div key={item.path} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-black/10 p-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {item.kind === "zip" || item.kind === "rar" ? (
                      <FileArchive className="h-4 w-4 shrink-0 text-violet-300/65" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0 text-cyan-300/65" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white/62">
                        {item.name}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/25">
                        {item.kind === "zip" || item.kind === "rar"
                          ? `${item.kind.toUpperCase()} archive • ${formatBytes(item.sizeBytes)}`
                          : "Extracted folder"
                        }
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => prepareStaged(item)}
                    disabled={busy || (item.kind === "rar" && !status.rarSupported)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-cyan-100/65 hover:bg-cyan-400/[0.10] disabled:opacity-35"
                  >
                    {preparingPath === item.path ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : item.kind === "zip" || item.kind === "rar" ? (
                      <FileArchive className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    {item.kind === "zip" || item.kind === "rar"
                      ? "Extract & Preview"
                      : "Preview"
                    }
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center text-xs text-white/28">
              This staging folder is empty.
            </div>
          )}
        </div>
      ) : null}


      {preview ? (
        <div className="border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/35">
            <ShieldCheck className="h-4 w-4 text-cyan-300/70" />
            Deployment preview
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-white/[0.07] bg-black/10 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-white/25">Files</div>
              <div className="mt-1 text-sm font-semibold text-white/65">{preview.fileCount.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-black/10 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-white/25">Size</div>
              <div className="mt-1 text-sm font-semibold text-white/65">{formatBytes(preview.totalSizeBytes)}</div>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-black/10 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-white/25">Existing files</div>
              <div className="mt-1 text-sm font-semibold text-white/65">{preview.existingFileCount.toLocaleString()}</div>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-black/10 p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-white/25">Managed overlaps</div>
              <div className="mt-1 text-sm font-semibold text-white/65">{preview.managedConflictCount.toLocaleString()}</div>
            </div>
          </div>

          <div className="mt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-white/30" htmlFor="linux-mod-name">
              Mod name
            </label>
            <input
              id="linux-mod-name"
              value={modName}
              onChange={(event) => setModName(event.target.value)}
              maxLength={120}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/75 outline-none focus:border-cyan-400/30"
            />
          </div>

          <div className="mt-3 break-all font-mono text-[10px] text-white/25">
            Source: {preview.sourcePath}
          </div>

          <div className="mt-2 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.035] px-3 py-2.5 text-[10px] text-cyan-100/50">
            <span className="font-semibold uppercase tracking-wide text-cyan-100/65">
              {preview.deploymentMode ?? "Game root"}
            </span>
            <span className="mx-2 text-white/20">•</span>
            Destination: <span className="break-all font-mono">{preview.destinationRoot ?? "Game installation root"}</span>
            {preview.skippedFileCount > 0 ? (
              <span className="ml-2 text-white/30">
                • {preview.skippedFileCount} documentation file{preview.skippedFileCount === 1 ? "" : "s"} kept in staging
              </span>
            ) : null}
          </div>

          {preview.fileSamples?.length > 0 ? (
            <div className="mt-3 rounded-lg border border-white/[0.07] bg-black/10 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-white/28">
                Payload layout preview
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
                {preview.fileSamples.map((path) => (
                  <div key={path} className="break-all font-mono text-[10px] text-white/25">
                    {path}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {preview.conflictSamples.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-100/65">
                <AlertTriangle className="h-4 w-4" />
                Existing files will be backed up before replacement
              </div>
              <div className="mt-2 space-y-1">
                {preview.conflictSamples.map((path) => (
                  <div key={path} className="break-all font-mono text-[10px] text-amber-100/40">
                    {path}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs leading-relaxed text-white/30">
              {preview.warning} Installers and scripts are never executed by GameAtlas.
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => openFolder(preview.sourcePath)}
                disabled={deploying}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/50 hover:bg-white/[0.06] disabled:opacity-35"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open Source
              </button>
              <button
                type="button"
                onClick={deploy}
                disabled={deploying || !modName.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2 text-xs font-semibold text-emerald-100/75 hover:bg-emerald-400/[0.13] disabled:opacity-35"
              >
                {deploying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PackagePlus className="h-3.5 w-3.5" />
                )}
                Deploy Mod
              </button>
            </div>
          </div>
        </div>
      ) : null}


      <div className="p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/30">
          Managed deployments
        </div>

        {loading && !status ? (
          <div className="flex items-center gap-2 py-3 text-xs text-white/35">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading managed deployments…
          </div>
        ) : status?.deployments?.length > 0 ? (
          <div className="space-y-2">
            {status.deployments.map((deployment, index) => (
              <div key={deployment.id} className="rounded-lg border border-white/[0.07] bg-black/10 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-white/68">{deployment.name}</div>
                      {index === 0 ? (
                        <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/60">
                          Newest
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[10px] text-white/27">
                      {deployment.fileCount.toLocaleString()} files
                      {" • "}
                      {formatBytes(deployment.totalSizeBytes)}
                      {" • "}
                      {deployment.overwrittenFileCount.toLocaleString()} backed up
                      {" • "}
                      {formatDate(deployment.deployedUnix)}
                    </div>
                    <div className="mt-1.5 break-all font-mono text-[10px] text-white/20">
                      {deployment.sourcePath}
                    </div>
                    {!deployment.canRemove ? (
                      <div className="mt-2 text-[10px] text-amber-100/38">
                        Remove newer deployments first to preserve overwrite order.
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeDeployment(deployment)}
                    disabled={!deployment.canRemove || busy}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.055] px-3 py-2 text-xs font-semibold text-red-100/65 hover:bg-red-400/[0.10] disabled:opacity-30"
                  >
                    {removingId === deployment.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-5 text-center text-xs text-white/30">
            No GameAtlas-managed mods are deployed for this game.
          </div>
        )}
      </div>


      <div className="border-t border-white/[0.06] px-4 py-3 text-[10px] leading-relaxed text-white/22">
        ZIP and RAR extraction is local and rejects unsafe paths, links, special files, password protection, excessive size, and case-only duplicates. RAR support uses the detected system lsar/unar tools. GameAtlas does not download mods, resolve mod-specific installation rules, run installers, or guarantee compatibility. Confirm that the preview has the layout expected at the game root.
      </div>
    </div>
  );
}
