import {
  AlertTriangle,
  Download,
  ExternalLink,
  FolderOpen,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  openUrl,
} from "@tauri-apps/plugin-opener";
import {
  listen,
} from "@tauri-apps/api/event";

import {
  cancelNexusDownload,
  connectNexusAccount,
  dismissNxmLink,
  downloadNexusFile,
  disconnectNexusAccount,
  getNexusAccountStatus,
  getPendingNxmLinks,
  inspectNxmLink,
  lookupNexusMod,
  refreshNexusAccount,
} from "../services/nexusIntegration";


const NEXUS_API_SETTINGS =
  "https://www.nexusmods.com/users/myaccount?tab=api";

const EXTERNAL_INSTALLER_EXTENSIONS = new Set([
  "appimage",
  "bat",
  "cmd",
  "exe",
  "msi",
  "ps1",
  "run",
  "sh",
]);


function fileExtension(
  fileName
) {
  return String(fileName ?? "")
    .split(".")
    .pop()
    ?.toLowerCase()
    ?? "";
}


function isSupportedArchive(
  fileName
) {
  return [
    "zip",
    "rar",
    "7z",
  ].includes(fileExtension(fileName));
}


function unsupportedFileGuidance(
  fileName
) {
  const extension = fileExtension(fileName);
  if (EXTERNAL_INSTALLER_EXTENSIONS.has(extension)) {
    return `“${fileName}” is an installer or script, not a supported mod archive. GameAtlas will not run it. Review the Nexus instructions and handle it outside GameAtlas only if you trust its source and understand the changes it makes.`;
  }
  return `“${fileName}” is not a ZIP, RAR, or 7z archive, so GameAtlas cannot import it directly. Review the Nexus instructions. If the file can be arranged as normal game-root files, place those files in their own extracted folder under VortexMods; otherwise manage it outside GameAtlas.`;
}


const NEXUS_FILE_GROUPS = [
  ["main", "Main files"],
  ["update", "Updates"],
  ["optional", "Optional files"],
  ["other", "Other files"],
  ["archived", "Archived files"],
];


function nexusFileGroup(
  file
) {
  const category = String(file?.categoryName ?? "").toLowerCase();
  if (
    category.includes("archiv")
    || category.includes("old")
    || category.includes("delete")
  ) {
    return "archived";
  }
  if (category.includes("update")) {
    return "update";
  }
  if (category.includes("optional")) {
    return "optional";
  }
  if (category.includes("main") || file?.primary) {
    return "main";
  }
  return "other";
}


function formatBytes(
  bytes
) {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "Unknown size";
  }
  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}


function formatDate(
  unix
) {
  const value = Number(unix ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "Unknown date";
  }
  return new Date(value * 1000).toLocaleString();
}


function formatReset(
  value
) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString();
}


export default function NexusIntegrationPanel({
  game,
  onArchiveReady,
  onAccountStatusChange,
  onOpenStagingFolder,
  onRefreshStaging,
}) {
  const [
    account,
    setAccount,
  ] = useState(null);
  const [
    apiKey,
    setApiKey,
  ] = useState("");
  const [
    nexusUrl,
    setNexusUrl,
  ] = useState("");
  const [
    metadata,
    setMetadata,
  ] = useState(null);
  const [
    action,
    setAction,
  ] = useState(null);
  const [
    error,
    setError,
  ] = useState(null);
  const [
    notice,
    setNotice,
  ] = useState(null);
  const [
    pendingNxm,
    setPendingNxm,
  ] = useState(null);
  const [
    pendingQueueRevision,
    setPendingQueueRevision,
  ] = useState(0);
  const [
    pendingQueueMessage,
    setPendingQueueMessage,
  ] = useState(null);
  const [
    downloadProgress,
    setDownloadProgress,
  ] = useState(null);
  const [
    cancelingDownload,
    setCancelingDownload,
  ] = useState(false);
  const [
    fileGuidance,
    setFileGuidance,
  ] = useState(null);
  const [
    catalogQuery,
    setCatalogQuery,
  ] = useState("");
  const [
    catalogCategory,
    setCatalogCategory,
  ] = useState("all");
  const [
    showArchivedFiles,
    setShowArchivedFiles,
  ] = useState(false);
  const [
    accountExpanded,
    setAccountExpanded,
  ] = useState(false);
  const [
    acquisitionMode,
    setAcquisitionMode,
  ] = useState(null);


  async function syncAccountFromSession() {
    try {
      const next = await getNexusAccountStatus();
      setAccount(next);
      onAccountStatusChange?.(next);
    } catch {
      // Preserve the actionable request error when local status cannot be read.
    }
  }


  useEffect(
    () => {
      let active = true;
      getNexusAccountStatus()
        .then(
          (next) => {
            if (active) {
              setAccount(next);
              onAccountStatusChange?.(next);
            }
          }
        )
        .catch(
          (loadError) => {
            if (active) {
              setError(String(loadError));
              setAccount({
                connected: false,
              });
            }
          }
        );
      return () => {
        active = false;
      };
    },
    []
  );


  useEffect(
    () => {
      setCatalogQuery("");
      setCatalogCategory("all");
      setShowArchivedFiles(false);
    },
    [
      metadata?.gameDomain,
      metadata?.modId,
    ]
  );


  useEffect(
    () => {
      let active = true;
      let stopListening = null;

      listen(
        "gameatlas:nexus-download-progress",
        (event) => {
          if (!active || !event.payload?.downloadId) {
            return;
          }
          setDownloadProgress(event.payload);
          if (event.payload.phase === "canceled") {
            setCancelingDownload(false);
          }
        }
      )
        .then(
          (unlisten) => {
            if (active) {
              stopListening = unlisten;
            } else {
              unlisten();
            }
          }
        )
        .catch(
          (listenError) => {
            if (active) {
              setError(String(listenError));
            }
          }
        );

      function handlePreparation(event) {
        const detail = event.detail;
        if (!detail?.downloadId) {
          return;
        }
        setDownloadProgress(
          (current) => current?.downloadId === detail.downloadId
            ? {
                ...current,
                phase: detail.phase,
              }
            : current
        );
      }

      window.addEventListener(
        "gameatlas:nexus-download-stage",
        handlePreparation
      );

      return () => {
        active = false;
        stopListening?.();
        window.removeEventListener(
          "gameatlas:nexus-download-stage",
          handlePreparation
        );
      };
    },
    []
  );


  useEffect(
    () => {
      let active = true;
      let stopListening = null;
      let stopErrorListening = null;

      listen(
        "gameatlas:nxm-link",
        () => setPendingQueueRevision(
          (current) => current + 1
        )
      )
        .then(
          (unlisten) => {
            if (active) {
              stopListening = unlisten;
            } else {
              unlisten();
            }
          }
        )
        .catch(
          (listenError) => {
            if (active) {
              setError(String(listenError));
            }
          }
        );

      listen(
        "gameatlas:nxm-link-error",
        (event) => {
          if (active) {
            setError(String(event.payload));
          }
        }
      )
        .then(
          (unlisten) => {
            if (active) {
              stopErrorListening = unlisten;
            } else {
              unlisten();
            }
          }
        )
        .catch(
          (listenError) => {
            if (active) {
              setError(String(listenError));
            }
          }
        );

      function handleQueueChange(event) {
        if (event.detail?.source !== "nexus-panel") {
          setPendingQueueRevision(
            (current) => current + 1
          );
        }
      }
      window.addEventListener(
        "gameatlas:nxm-queue-changed",
        handleQueueChange
      );
      window.dispatchEvent(
        new CustomEvent(
          "gameatlas:nxm-queue-changed",
          {
            detail: {
              source: "nexus-panel",
            },
          }
        )
      );
      return () => {
        active = false;
        stopListening?.();
        stopErrorListening?.();
        window.removeEventListener(
          "gameatlas:nxm-queue-changed",
          handleQueueChange
        );
        window.dispatchEvent(
          new CustomEvent(
            "gameatlas:nxm-queue-changed",
            {
              detail: {
                source: "nexus-panel",
              },
            }
          )
        );
      };
    },
    []
  );


  useEffect(
    () => {
      let active = true;

      async function loadPendingLink() {
        let discardedCount = 0;
        let lastDiscardedError = null;
        try {
          while (active) {
            const links = await getPendingNxmLinks();
            if (!active) {
              return;
            }
            const nxmUrl = links?.[0];
            if (!nxmUrl) {
              setPendingNxm(null);
              setPendingQueueMessage(
                discardedCount > 0
                  ? `${discardedCount} invalid or expired Nexus request${discardedCount === 1 ? " was" : "s were"} discarded${lastDiscardedError ? `: ${lastDiscardedError}` : "."}`
                  : null
              );
              return;
            }
            try {
              const info = await inspectNxmLink(nxmUrl);
              if (!active) {
                return;
              }
              setPendingNxm(
                (current) => current?.nxmUrl === nxmUrl
                  ? {
                      ...current,
                      queueCount: links.length,
                    }
                  : {
                      nxmUrl,
                      info,
                      queueCount: links.length,
                    }
              );
              setAcquisitionMode("manager");
              setPendingQueueMessage(
                discardedCount > 0
                  ? `${discardedCount} invalid or expired Nexus request${discardedCount === 1 ? " was" : "s were"} discarded. Showing the next request.`
                  : null
              );
              return;
            } catch (linkError) {
              lastDiscardedError = String(linkError);
              await dismissNxmLink(nxmUrl);
              discardedCount += 1;
            }
          }
        } catch (queueError) {
          if (active) {
            setError(String(queueError));
          }
        }
      }

      loadPendingLink();
      return () => {
        active = false;
      };
    },
    [pendingQueueRevision]
  );


  useEffect(
    () => {
      const expiresUnix = Number(
        pendingNxm?.info.expiresUnix
      );
      const downloadingPendingRequest = action === `download-${pendingNxm?.info.fileId}`;
      if (
        !Number.isFinite(expiresUnix)
        || expiresUnix <= 0
        || downloadingPendingRequest
      ) {
        return undefined;
      }
      const delay = Math.min(
        Math.max(
          (expiresUnix * 1000) - Date.now() + 250,
          0
        ),
        2_147_000_000
      );
      const timer = window.setTimeout(
        () => setPendingQueueRevision(
          (current) => current + 1
        ),
        delay
      );
      return () => window.clearTimeout(timer);
    },
    [
      pendingNxm?.nxmUrl,
      pendingNxm?.info.expiresUnix,
      action,
    ]
  );


  useEffect(
    () => {
      if (
        !account?.connected
        || !pendingNxm
        || (
          metadata?.gameDomain === pendingNxm.info.gameDomain
          && metadata?.modId === pendingNxm.info.modId
        )
      ) {
        return;
      }

      let active = true;
      setAction("nxm-lookup");
      setError(null);
      setNotice(null);
      lookupNexusMod(pendingNxm.info.modPageUrl)
        .then(
          async (next) => {
            if (!active) {
              return;
            }
            setMetadata(next);
            setFileGuidance(null);
            setNexusUrl(next.modPageUrl);
            const nextAccount = await getNexusAccountStatus();
            if (active) {
              setAccount(nextAccount);
              onAccountStatusChange?.(nextAccount);
            }
          }
        )
        .catch(
          async (lookupError) => {
            if (active) {
              setError(String(lookupError));
              await syncAccountFromSession();
            }
          }
        )
        .finally(
          () => {
            setAction(
              (current) => current === "nxm-lookup"
                ? null
                : current
            );
          }
        );

      return () => {
        active = false;
      };
    },
    [
      account?.connected,
      pendingNxm?.nxmUrl,
      metadata?.gameDomain,
      metadata?.modId,
    ]
  );


  useEffect(
    () => {
      if (
        !pendingNxm
        || metadata?.gameDomain !== pendingNxm.info.gameDomain
        || metadata?.modId !== pendingNxm.info.modId
        || metadata.files.some(
          (file) => file.fileId === pendingNxm.info.fileId
        )
      ) {
        return undefined;
      }
      let active = true;
      const invalidFileId = pendingNxm.info.fileId;
      dismissNxmLink(pendingNxm.nxmUrl)
        .then(
          () => {
            if (!active) {
              return;
            }
            setPendingNxm(null);
            setNotice(
              `Nexus file ${invalidFileId} is no longer present in this mod's catalog. The invalid request was removed and the queue advanced.`
            );
            setPendingQueueRevision(
              (current) => current + 1
            );
            window.dispatchEvent(
              new CustomEvent(
                "gameatlas:nxm-queue-changed",
                {
                  detail: {
                    source: "nexus-panel",
                  },
                }
              )
            );
          }
        )
        .catch(
          (dismissError) => {
            if (active) {
              setError(String(dismissError));
            }
          }
        );
      return () => {
        active = false;
      };
    },
    [
      pendingNxm?.nxmUrl,
      metadata?.gameDomain,
      metadata?.modId,
      metadata?.files,
    ]
  );


  async function connect(
    event
  ) {
    event.preventDefault();
    if (!apiKey.trim()) {
      return;
    }
    setAction("connect");
    setError(null);
    setNotice(null);
    try {
      const next = await connectNexusAccount(apiKey);
      setAccount(next);
      onAccountStatusChange?.(next);
      setApiKey("");
      setAccountExpanded(false);
    } catch (connectError) {
      setError(String(connectError));
    } finally {
      setAction(null);
    }
  }


  async function refresh() {
    setAction("refresh");
    setError(null);
    setNotice(null);
    try {
      const next = await refreshNexusAccount();
      setAccount(next);
      onAccountStatusChange?.(next);
    } catch (refreshError) {
      setError(String(refreshError));
      await syncAccountFromSession();
    } finally {
      setAction(null);
    }
  }


  async function disconnect() {
    setAction("disconnect");
    setError(null);
    setNotice(null);
    try {
      const next = await disconnectNexusAccount();
      setAccount(next);
      onAccountStatusChange?.(next);
      setMetadata(null);
      setNexusUrl("");
      setFileGuidance(null);
      setAcquisitionMode(null);
      setAccountExpanded(false);
    } catch (disconnectError) {
      setError(String(disconnectError));
    } finally {
      setAction(null);
    }
  }


  async function lookup(
    event
  ) {
    event.preventDefault();
    if (!nexusUrl.trim()) {
      return;
    }
    setAction("lookup");
    setError(null);
    setNotice(null);
    setFileGuidance(null);
    try {
      const next = await lookupNexusMod(nexusUrl);
      setMetadata(next);
      const nextAccount = await getNexusAccountStatus();
      setAccount(nextAccount);
      onAccountStatusChange?.(nextAccount);
    } catch (lookupError) {
      setMetadata(null);
      setError(String(lookupError));
      await syncAccountFromSession();
    } finally {
      setAction(null);
    }
  }


  async function openExternal(
    target
  ) {
    setError(null);
    try {
      await openUrl(target);
      return true;
    } catch (openError) {
      setError(String(openError));
      return false;
    }
  }


  async function downloadFile(
    file
  ) {
    const usesPendingNxm = pendingNxm?.info.fileId === file.fileId
      && pendingNxm?.info.modId === metadata.modId
      && pendingNxm?.info.gameDomain === metadata.gameDomain;
    if (usesPendingNxm) {
      const confirmed = window.confirm(
        `Download “${file.name || file.fileName || `Nexus file ${file.fileId}`}” for “${game?.name || "the selected game"}”?\n\nThe archive will be saved in this game's VortexMods staging folder. Confirm that this is the intended destination.`
      );
      if (!confirmed) {
        return;
      }
    }
    setAction(`download-${file.fileId}`);
    setError(null);
    setNotice(null);
    let completedPendingRequest = false;
    try {
      const result = await downloadNexusFile(
        game,
        metadata,
        file,
        usesPendingNxm
          ? pendingNxm.nxmUrl
          : null
      );
      if (usesPendingNxm) {
        await dismissNxmLink(pendingNxm.nxmUrl);
        setPendingNxm(null);
        completedPendingRequest = true;
      }
      setFileGuidance(null);
      setNotice(result.message);
      const nextAccount = await getNexusAccountStatus();
      setAccount(nextAccount);
      onAccountStatusChange?.(nextAccount);
      await onArchiveReady?.({
        download: result,
        mod: metadata,
        file,
      });
    } catch (downloadError) {
      const message = String(downloadError);
      if (message.toLowerCase().includes("download canceled")) {
        setNotice("Nexus download canceled. The partial file was removed.");
      } else {
        setError(message);
      }
      await syncAccountFromSession();
    } finally {
      setAction(null);
      setCancelingDownload(false);
      if (completedPendingRequest) {
        setPendingQueueRevision(
          (current) => current + 1
        );
        window.dispatchEvent(
          new CustomEvent(
            "gameatlas:nxm-queue-changed",
            {
              detail: {
                source: "nexus-panel",
              },
            }
          )
        );
      }
    }
  }


  async function cancelDownload() {
    if (!downloadProgress?.downloadId) {
      return;
    }
    setCancelingDownload(true);
    setError(null);
    try {
      const canceled = await cancelNexusDownload(
        downloadProgress.downloadId
      );
      if (!canceled) {
        setCancelingDownload(false);
        setError("That Nexus download is no longer active.");
      }
    } catch (cancelError) {
      setCancelingDownload(false);
      setError(String(cancelError));
    }
  }


  function reviewDeployment() {
    const target = document.getElementById(
      "linux-mod-deployment-preview"
    );
    target?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    target?.focus({
      preventScroll: true,
    });
    setDownloadProgress(null);
  }


  async function dismissPendingNxm() {
    if (!pendingNxm) {
      return;
    }
    try {
      await dismissNxmLink(pendingNxm.nxmUrl);
      setPendingNxm(null);
      setPendingQueueRevision(
        (current) => current + 1
      );
      window.dispatchEvent(
        new CustomEvent(
          "gameatlas:nxm-queue-changed",
          {
            detail: {
              source: "nexus-panel",
            },
          }
        )
      );
    } catch (dismissError) {
      setError(String(dismissError));
    }
  }


  async function openFilePage(
    file
  ) {
    const supportedArchive = isSupportedArchive(
      file.fileName
    );
    const opened = await openExternal(
      `${metadata.modPageUrl}?tab=files&file_id=${file.fileId}`
    );
    if (!opened) {
      return;
    }
    setNotice(null);
    setFileGuidance({
      fileId: file.fileId,
      fileName: file.fileName || file.name || `Nexus file ${file.fileId}`,
      supportedArchive,
      message: supportedArchive
        ? `Download “${file.fileName || file.name}” in your browser. When it finishes, move the original archive into the VortexMods staging folder for ${game?.name || "this game"}. Return here, refresh staged mods, then choose Extract & Preview. Do not install or extract it directly into the game first.`
        : unsupportedFileGuidance(file.fileName || file.name),
    });
  }


  const busy = Boolean(action);
  const connected = Boolean(account?.connected);
  const quotaExhausted = account?.hourlyRemaining === 0
    || account?.dailyRemaining === 0;
  const pendingNxmFile = pendingNxm
    && metadata?.gameDomain === pendingNxm.info.gameDomain
    && metadata?.modId === pendingNxm.info.modId
    ? metadata.files.find(
        (file) => file.fileId === pendingNxm.info.fileId
      )
    : null;
  const pendingNxmSupportedArchive = Boolean(
    pendingNxmFile
    && isSupportedArchive(pendingNxmFile.fileName)
  );
  const pendingNxmCanDownload = Boolean(
    pendingNxmSupportedArchive
    && (
      account?.isPremium
      || pendingNxm?.info.authenticated
    )
  );
  const progressPercent = downloadProgress?.totalBytes > 0
    ? Math.min(
        100,
        (downloadProgress.bytesDownloaded / downloadProgress.totalBytes) * 100
      )
    : null;
  const downloadActive = downloadProgress?.phase === "resolving"
    || downloadProgress?.phase === "downloading";
  const progressLabel = {
    resolving: "Resolving a secure Nexus download link…",
    downloading: "Downloading archive…",
    downloaded: "Download complete. Preparing the archive…",
    preparing: "Safely extracting and validating the archive…",
    ready: "Archive ready for deployment review",
    canceled: "Download canceled",
    failed: "Download could not be completed",
    "preparation-error": "Archive preparation needs attention",
  }[downloadProgress?.phase] ?? "Nexus download";
  const archivedFileCount = metadata?.files.filter(
    (file) => nexusFileGroup(file) === "archived"
  ).length ?? 0;
  const catalogGroups = useMemo(
    () => {
      const query = catalogQuery.trim().toLowerCase();
      const visibleFiles = (metadata?.files ?? [])
        .filter(
          (file) => {
            const group = nexusFileGroup(file);
            if (group === "archived" && !showArchivedFiles) {
              return false;
            }
            if (catalogCategory !== "all" && group !== catalogCategory) {
              return false;
            }
            if (!query) {
              return true;
            }
            return [
              file.name,
              file.fileName,
              file.version,
              file.categoryName,
            ].some(
              (value) => String(value ?? "").toLowerCase().includes(query)
            );
          }
        )
        .sort(
          (left, right) => Number(Boolean(right.primary)) - Number(Boolean(left.primary))
            || Number(right.uploadedUnix ?? 0) - Number(left.uploadedUnix ?? 0)
            || Number(right.fileId ?? 0) - Number(left.fileId ?? 0)
        );
      return NEXUS_FILE_GROUPS
        .map(
          ([id, label]) => ({
            id,
            label,
            files: visibleFiles.filter(
              (file) => nexusFileGroup(file) === id
            ),
          })
        )
        .filter((group) => group.files.length > 0);
    },
    [
      metadata?.files,
      catalogQuery,
      catalogCategory,
      showArchivedFiles,
    ]
  );
  const visibleCatalogFileCount = catalogGroups.reduce(
    (total, group) => total + group.files.length,
    0
  );


  return (
    <div
      id="gameatlas-nexus-integration"
      className="border-b border-white/[0.06] bg-violet-400/[0.015] p-4"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200/70">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-white/80">
                Nexus Mods
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${connected ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-100/65" : "border-white/10 bg-white/[0.03] text-white/45"}`}>
                {!account ? "Checking account…" : connected ? "Connected" : "Not connected"}
              </span>
              {pendingNxm ? (
                <span className="rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-2 py-0.5 text-[10px] font-semibold text-violet-100/70">
                  Downloads: {pendingNxm.queueCount}
                </span>
              ) : null}
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/45">
              Send files with <span className="font-semibold text-violet-100/65">Mod Manager Download</span> or browse a mod&apos;s files manually, then prepare them in the VortexMods staging folder for {game?.name || "this game"}.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openExternal(NEXUS_API_SETTINGS)}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-white/45 hover:bg-white/[0.06]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Account & API help
        </button>
      </div>

      {error || notice || pendingQueueMessage ? (
        <div
          className={`mt-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${error ? "border-red-400/15 bg-red-400/[0.05] text-red-100/75" : pendingQueueMessage ? "border-amber-300/15 bg-amber-300/[0.045] text-amber-100/70" : "border-emerald-400/15 bg-emerald-400/[0.045] text-emerald-100/70"}`}
          role="status"
          aria-live={error ? "assertive" : "polite"}
          aria-atomic="true"
        >
          <div className="font-semibold">
            {error ? "Nexus action needs attention" : pendingQueueMessage ? "Download queue updated" : "Nexus action complete"}
          </div>
          <div className="mt-0.5">
            {error || pendingQueueMessage || notice}
          </div>
        </div>
      ) : null}

      {downloadProgress ? (
        <div
          className="fixed bottom-5 right-5 z-[130] w-[min(30rem,calc(100vw-2.5rem))] rounded-xl border border-cyan-300/20 bg-[#111b24]/95 p-4 shadow-2xl backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-cyan-100/70">
                {downloadActive || downloadProgress.phase === "preparing" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : downloadProgress.phase === "ready" ? (
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                ) : null}
                {progressLabel}
              </div>
              <div className="mt-1 break-all text-[11px] text-white/60">
                {downloadProgress.fileName}
              </div>
              {downloadProgress.destination ? (
                <div className="mt-1 break-all font-mono text-[9px] text-white/28">
                  {downloadProgress.destination}
                </div>
              ) : (
                <div className="mt-1 text-[10px] text-white/30">
                  VortexMods staging folder for {game?.name || "the selected game"}
                </div>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {downloadActive ? (
                <button
                  type="button"
                  onClick={cancelDownload}
                  disabled={cancelingDownload}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-300/15 bg-red-300/[0.045] px-2.5 py-1.5 text-[10px] font-semibold text-red-100/60 hover:bg-red-300/[0.08] disabled:opacity-35"
                >
                  {cancelingDownload ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  {cancelingDownload ? "Canceling…" : "Cancel"}
                </button>
              ) : downloadProgress.phase === "ready" ? (
                <button
                  type="button"
                  onClick={reviewDeployment}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-semibold text-emerald-100/70 hover:bg-emerald-300/[0.12]"
                >
                  <ShieldCheck className="h-3 w-3" />
                  Review deployment
                </button>
              ) : downloadProgress.phase === "canceled" || downloadProgress.phase === "failed" || downloadProgress.phase === "preparation-error" ? (
                <button
                  type="button"
                  onClick={() => setDownloadProgress(null)}
                  className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/45 hover:bg-white/[0.05]"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>

          {downloadProgress.phase === "downloading" ? (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className={`h-full rounded-full bg-cyan-300/60 transition-[width] duration-200 ${progressPercent === null ? "w-full animate-pulse" : ""}`}
                  style={progressPercent === null ? undefined : { width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/35">
                <span>
                  {downloadProgress.bytesDownloaded > 0
                    ? formatBytes(downloadProgress.bytesDownloaded)
                    : "0 B"
                  }
                  {downloadProgress.totalBytes ? ` of ${formatBytes(downloadProgress.totalBytes)}` : " downloaded"}
                  {progressPercent !== null ? ` · ${progressPercent.toFixed(0)}%` : ""}
                </span>
                <span>
                  {downloadProgress.bytesPerSecond > 0
                    ? `${formatBytes(downloadProgress.bytesPerSecond)}/s`
                    : "Calculating speed…"
                  }
                </span>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {pendingNxm ? (
        <div
          className="mt-3 rounded-lg border border-violet-300/15 bg-violet-300/[0.055] px-3 py-2.5"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-violet-100/80">
                <span>Nexus Mod Manager download received</span>
                <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wide text-violet-100/55">
                  {pendingNxm.queueCount > 1
                    ? `1 of ${pendingNxm.queueCount} pending`
                    : "1 pending"
                  }
                </span>
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-white/50">
                Nexus requested {pendingNxm.info.gameDomain} mod {pendingNxm.info.modId}, file {pendingNxm.info.fileId}.
              </div>
              <div className="mt-1.5 rounded-md border border-amber-300/10 bg-amber-300/[0.035] px-2.5 py-2 text-[11px] leading-relaxed text-amber-100/70">
                Destination: <span className="font-semibold text-amber-100/75">{game?.name || "No game selected"}</span>. {pendingNxmFile && !pendingNxmSupportedArchive
                  ? "This file cannot be staged directly; the destination identifies which game's instructions you are reviewing."
                  : "The archive will be staged only for this game. You will confirm this destination again before the download begins."
                }
              </div>
              {pendingNxmFile && !pendingNxmCanDownload ? (
                <div className="mt-1.5 text-[11px] leading-relaxed text-amber-100/65">
                  {pendingNxmSupportedArchive
                    ? "This Nexus link cannot be resolved directly with the connected account. Continue on the file page and use the browser-download staging steps."
                    : "This requested file is not a ZIP, RAR, or 7z archive. GameAtlas cannot import it directly; review its Nexus instructions before handling it manually."
                  }
                </div>
              ) : null}
              {!account?.connected ? (
                <div className="mt-1 text-[11px] text-amber-100/65">
                  Connect the same Nexus account used to create the link to continue.
                </div>
              ) : pendingNxmFile && !pendingNxmCanDownload ? (
                <button
                  type="button"
                  onClick={() => openFilePage(pendingNxmFile)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/[0.05] disabled:opacity-35"
                >
                  <ExternalLink className="h-3 w-3" />
                  {pendingNxmSupportedArchive ? "Download in browser" : "Open file page"}
                </button>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {action === "nxm-lookup" ? (
                <div className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-violet-100/60">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading selected file…
                </div>
              ) : pendingNxmCanDownload ? (
                <button
                  type="button"
                  onClick={() => downloadFile(pendingNxmFile)}
                  disabled={busy || !game?.name || quotaExhausted}
                  title={quotaExhausted ? "Refresh the Nexus account after its quota resets." : undefined}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-emerald-100/75 hover:bg-emerald-300/[0.10] disabled:opacity-35"
                >
                  {action === `download-${pendingNxmFile.fileId}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Download for {game?.name || "selected game"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={dismissPendingNxm}
                disabled={busy}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/55 hover:bg-white/[0.05] disabled:opacity-35"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!account ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-white/45" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading Nexus account status…
        </div>
      ) : (
        <div className="mt-3">
          <div className={`rounded-lg border px-3 py-2.5 ${connected ? (account.hourlyRemaining === 0 || account.dailyRemaining === 0 ? "border-red-400/15 bg-red-400/[0.04]" : (account.hourlyRemaining ?? Infinity) <= 10 || (account.dailyRemaining ?? Infinity) <= 10 ? "border-amber-400/15 bg-amber-400/[0.04]" : "border-emerald-400/10 bg-emerald-400/[0.035]") : "border-white/[0.08] bg-black/10"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <UserRound className={`h-4 w-4 shrink-0 ${connected ? "text-emerald-200/65" : "text-white/35"}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/75">
                    {connected ? (account.name ?? "Connected Nexus user") : "Nexus account"}
                    {connected ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${account.isPremium ? "border-amber-300/15 bg-amber-300/[0.06] text-amber-100/65" : account.isSupporter ? "border-violet-300/15 bg-violet-300/[0.06] text-violet-100/65" : "border-white/10 bg-white/[0.03] text-white/45"}`}>
                        {account.isPremium ? "Premium" : account.isSupporter ? "Supporter" : "Free"}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/45">
                    {connected
                      ? `Quota: ${account.hourlyRemaining ?? "—"} hourly · ${account.dailyRemaining ?? "—"} daily remaining`
                      : "Connect once per session to browse Nexus files and handle downloads."
                    }
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccountExpanded((current) => !current)}
                aria-expanded={accountExpanded}
                aria-controls="nexus-account-details"
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/55 hover:bg-white/[0.05]"
              >
                {connected ? "Account details" : "Connect account"}
              </button>
            </div>
            {accountExpanded ? (
              connected ? (
                <div id="nexus-account-details" className="mt-3 border-t border-white/[0.06] pt-3">
                  {account.hourlyRemaining === 0 || account.dailyRemaining === 0 ? (
                    <div className="flex items-start gap-2 text-xs leading-relaxed text-red-100/70">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Nexus requests are paused until quota resets{formatReset(account.dailyRemaining === 0 ? account.dailyReset : account.hourlyReset) ? ` at ${formatReset(account.dailyRemaining === 0 ? account.dailyReset : account.hourlyReset)}` : ""}.</span>
                    </div>
                  ) : (account.hourlyRemaining ?? Infinity) <= 10 || (account.dailyRemaining ?? Infinity) <= 10 ? (
                    <div className="flex items-start gap-2 text-xs leading-relaxed text-amber-100/65">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Nexus quota is low. Automatic update checks pause to preserve remaining requests.</span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/45">Credentials remain in memory for this session only.</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={refresh}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/55 hover:bg-white/[0.05] disabled:opacity-35"
                    >
                      <RefreshCw className={`h-3 w-3 ${action === "refresh" ? "animate-spin" : ""}`} />
                      Refresh quota
                    </button>
                    <button
                      type="button"
                      onClick={disconnect}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/55 hover:bg-white/[0.05] disabled:opacity-35"
                    >
                      <LogOut className="h-3 w-3" />
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <form id="nexus-account-details" onSubmit={connect} className="mt-3 border-t border-white/[0.06] pt-3">
                  <label htmlFor="nexus-api-key" className="block text-[11px] font-semibold text-white/60">
                    Personal Nexus Mods API key
                  </label>
                  <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="nexus-api-key"
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="Paste API key"
                      autoComplete="off"
                      spellCheck="false"
                      disabled={busy}
                      aria-describedby="nexus-api-key-help"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75 outline-none placeholder:text-white/25 focus:border-violet-300/30 disabled:opacity-40"
                    />
                    <button
                      type="submit"
                      disabled={busy || !apiKey.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[0.08] px-3 py-2 text-xs font-semibold text-violet-100/75 hover:bg-violet-300/[0.12] disabled:opacity-35"
                    >
                      {action === "connect" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                      Connect
                    </button>
                  </div>
                  <div id="nexus-api-key-help" className="mt-1.5 text-[11px] leading-relaxed text-white/40">
                    The key is used only for this session. Create or manage it through Account & API help above.
                  </div>
                </form>
              )
            ) : null}
          </div>

          {connected ? (
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/10 p-3">
              <div id="nexus-acquisition-heading" className="text-xs font-semibold text-white/70">
                Add from Nexus Mods
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-white/42">
                Choose the same download path you would use in Vortex. Nothing is installed until you review the staged deployment.
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2" role="group" aria-labelledby="nexus-acquisition-heading">
                <button
                  type="button"
                  onClick={() => setAcquisitionMode("manager")}
                  aria-pressed={acquisitionMode === "manager"}
                  className={`rounded-lg border p-3 text-left transition-colors ${acquisitionMode === "manager" ? "border-violet-300/25 bg-violet-300/[0.08]" : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"}`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
                    <Download className="h-4 w-4 text-violet-200/70" />
                    Mod Manager Download
                    <span className="rounded-full border border-violet-300/15 px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-violet-100/55">Recommended</span>
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-white/42">
                    Use the Mod Manager Download button on Nexus. Requests arrive in the Downloads queue here.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setAcquisitionMode("catalog")}
                  aria-pressed={acquisitionMode === "catalog"}
                  className={`rounded-lg border p-3 text-left transition-colors ${acquisitionMode === "catalog" ? "border-cyan-300/20 bg-cyan-300/[0.06]" : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"}`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-white/75">
                    <Search className="h-4 w-4 text-cyan-200/65" />
                    Manual Download / Browse files
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-white/42">
                    Paste a mod page, compare its files, then choose a direct or browser download.
                  </div>
                </button>
              </div>

              {acquisitionMode === "manager" ? (
                <div className="mt-3 rounded-md border border-violet-300/12 bg-violet-300/[0.035] px-3 py-2.5">
                  <div className="text-xs leading-relaxed text-violet-100/65">
                    On Nexus Mods, open the mod&apos;s <span className="font-semibold">Files</span> tab and choose <span className="font-semibold">Mod Manager Download</span>. Keep GameAtlas running; the request will appear above and retain its place in the queue.
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-violet-300/15 px-2 py-1 text-[10px] font-semibold text-violet-100/60">
                      Downloads queue: {pendingNxm?.queueCount ?? 0}
                    </span>
                    {onOpenStagingFolder ? (
                      <button
                        type="button"
                        onClick={onOpenStagingFolder}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/55 hover:bg-white/[0.05]"
                      >
                        <FolderOpen className="h-3 w-3" />
                        Open VortexMods staging
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : acquisitionMode === "catalog" ? (
                <form onSubmit={lookup} className="mt-3">
                  <label htmlFor="nexus-mod-url" className="block text-[11px] font-semibold text-white/60">
                    Nexus Mods mod-page URL
                  </label>
                  <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="nexus-mod-url"
                      type="url"
                      value={nexusUrl}
                      onChange={(event) => setNexusUrl(event.target.value)}
                      placeholder="https://www.nexusmods.com/game/mods/123"
                      disabled={busy}
                      aria-describedby="nexus-mod-url-help"
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75 outline-none placeholder:text-white/25 focus:border-cyan-300/25 disabled:opacity-40"
                    />
                    <button
                      type="submit"
                      disabled={busy || !nexusUrl.trim() || quotaExhausted}
                      title={quotaExhausted ? "Refresh the Nexus account after its quota resets." : undefined}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-semibold text-cyan-100/70 hover:bg-cyan-300/[0.11] disabled:opacity-35"
                    >
                      {action === "lookup" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      Browse files
                    </button>
                  </div>
                  <div id="nexus-mod-url-help" className="mt-1.5 text-[11px] text-white/40">
                    Use the main mod page URL, not an individual download-mirror address.
                  </div>
                </form>
              ) : (
                <div className="mt-3 text-[11px] text-white/35">Select a download method to continue.</div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {metadata && acquisitionMode === "catalog" ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-black/15">
          <div className="border-b border-white/[0.06] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-white/70">
                    {metadata.name || `Nexus mod ${metadata.modId}`}
                  </div>
                  {metadata.version ? (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-white/38">
                      v{metadata.version}
                    </span>
                  ) : null}
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${metadata.available ? "border-emerald-300/15 text-emerald-100/50" : "border-red-300/15 text-red-100/50"}`}>
                    {metadata.available ? (metadata.status || "Available") : "Unavailable"}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-white/45">
                  By {metadata.author || "Unknown author"} · Updated {formatDate(metadata.updatedUnix)} · {metadata.endorsementCount ?? 0} endorsements
                </div>
                {metadata.summary ? (
                  <div className="mt-2 max-w-4xl text-xs leading-relaxed text-white/50">
                    {metadata.summary}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => openExternal(metadata.modPageUrl)}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/55 hover:bg-white/[0.05]"
              >
                <ExternalLink className="h-3 w-3" />
                Open mod page
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  File catalog ({visibleCatalogFileCount} of {metadata.files.length})
                </div>
                {!showArchivedFiles && archivedFileCount > 0 ? (
                  <div className="mt-0.5 text-[10px] text-white/35">
                    {archivedFileCount} archived file{archivedFileCount === 1 ? " is" : "s are"} hidden.
                  </div>
                ) : null}
              </div>
              {metadata.files.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="min-w-0 sm:w-52">
                    <span className="block text-[10px] font-semibold text-white/50">Filter files</span>
                    <span className="relative mt-1 block">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
                      <input
                        type="search"
                        value={catalogQuery}
                        onChange={(event) => setCatalogQuery(event.target.value)}
                        placeholder="Name, filename, or version"
                        className="w-full rounded-md border border-white/10 bg-black/20 py-1.5 pl-7 pr-2.5 text-[11px] text-white/65 outline-none placeholder:text-white/25 focus:border-violet-300/25"
                      />
                    </span>
                  </label>
                  <label>
                    <span className="block text-[10px] font-semibold text-white/50">Category</span>
                    <select
                      value={catalogCategory}
                      onChange={(event) => {
                        const category = event.target.value;
                        setCatalogCategory(category);
                        if (category === "archived") {
                          setShowArchivedFiles(true);
                        }
                      }}
                      className="mt-1 rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5 text-[11px] text-white/65 outline-none focus:border-violet-300/25"
                    >
                      <option value="all">All categories</option>
                      {NEXUS_FILE_GROUPS.map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-flex items-center gap-1.5 self-end whitespace-nowrap pb-1.5 text-[11px] text-white/50">
                    <input
                      type="checkbox"
                      checked={showArchivedFiles}
                      onChange={(event) => {
                        setShowArchivedFiles(event.target.checked);
                        if (!event.target.checked && catalogCategory === "archived") {
                          setCatalogCategory("all");
                        }
                      }}
                      className="accent-violet-400"
                    />
                    Show archived
                  </label>
                </div>
              ) : null}
            </div>
            {metadata.files.length > 0 ? (
              catalogGroups.length > 0 ? (
                <div className="mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
                  {catalogGroups.map((group) => (
                    <section key={group.id}>
                      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-white/[0.06] bg-[#121721]/95 px-1 py-1.5 backdrop-blur-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                          {group.label}
                        </div>
                        <span className="rounded-full border border-white/[0.07] px-1.5 py-0.5 text-[8px] text-white/25">
                          {group.files.length}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-1.5">
                        {group.files.map((file) => {
                          const requestedByNxm = pendingNxm?.info.fileId === file.fileId
                            && pendingNxm?.info.modId === metadata.modId
                            && pendingNxm?.info.gameDomain === metadata.gameDomain;
                          const canDownload = account?.isPremium
                            || (requestedByNxm && pendingNxm?.info.authenticated);
                          const supportedArchive = isSupportedArchive(file.fileName);
                          return (
                            <div
                              key={file.fileId}
                              className={`flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${requestedByNxm ? "border-violet-300/20 bg-violet-300/[0.045]" : "border-white/[0.06] bg-white/[0.018]"}`}
                            >
                              <div className="min-w-0">
                                <div className="break-words text-xs font-semibold text-white/65">
                                  {file.name || file.fileName || `File ${file.fileId}`}
                                  {file.primary ? (
                                    <span className="ml-2 text-[9px] uppercase tracking-wide text-emerald-100/45">
                                      Primary
                                    </span>
                                  ) : null}
                                  {requestedByNxm ? (
                                    <span className="ml-2 text-[9px] uppercase tracking-wide text-violet-100/60">
                                      Requested by Nexus
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-0.5 break-all font-mono text-[10px] text-white/40">
                                  {file.fileName || "Unknown filename"}
                                </div>
                                {!supportedArchive ? (
                                  <div className="mt-1 text-[10px] font-semibold text-amber-100/58">
                                    Not directly importable — review the file instructions
                                  </div>
                                ) : !canDownload ? (
                                  <div className="mt-1 text-[10px] font-semibold text-cyan-100/52">
                                    Supported archive — browser download required
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:max-w-[48%] sm:justify-end">
                                <div className="text-[10px] text-white/40">
                                  {file.categoryName || "Uncategorized"} · {file.version ? `v${file.version} · ` : ""}{formatBytes(file.sizeBytes)} · {formatDate(file.uploadedUnix)}
                                </div>
                                {canDownload && supportedArchive ? (
                                  <button
                                    type="button"
                                    onClick={() => downloadFile(file)}
                                    disabled={busy || !game?.name || quotaExhausted}
                                    title={quotaExhausted ? "Refresh the Nexus account after its quota resets." : undefined}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1.5 text-[10px] font-semibold text-emerald-100/70 hover:bg-emerald-300/[0.10] disabled:opacity-35"
                                  >
                                    {action === `download-${file.fileId}` ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Download className="h-3 w-3" />
                                    )}
                                    {requestedByNxm ? "Download Nexus selection" : "Download to VortexMods"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openFilePage(file)}
                                    disabled={busy}
                                    title={supportedArchive
                                      ? "Download this supported archive in your browser, then move it into VortexMods."
                                      : "Review this unsupported file and its installation instructions on Nexus Mods."
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/55 hover:bg-white/[0.05] disabled:opacity-35"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {supportedArchive ? "Download in browser" : "Open file page"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-white/[0.06] bg-white/[0.015] px-3 py-4 text-center text-[10px] text-white/28">
                  No files match the current filters.
                </div>
              )
            ) : (
              <div className="mt-2 text-[11px] text-white/28">
                Nexus returned no files for this mod.
              </div>
            )}

            {fileGuidance ? (
              <div className={`mt-3 rounded-lg border p-3 ${fileGuidance.supportedArchive ? "border-cyan-300/15 bg-cyan-300/[0.04]" : "border-amber-300/15 bg-amber-300/[0.04]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-[11px] font-semibold ${fileGuidance.supportedArchive ? "text-cyan-100/65" : "text-amber-100/65"}`}>
                      {fileGuidance.supportedArchive
                        ? "Finish this browser download in staging"
                        : "This file needs manual handling"
                      }
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed text-white/42">
                      {fileGuidance.message}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFileGuidance(null)}
                    aria-label="Dismiss file guidance"
                    className="shrink-0 rounded-md p-1 text-white/35 hover:bg-white/[0.06] hover:text-white/60"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {fileGuidance.supportedArchive ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onOpenStagingFolder ? (
                      <button
                        type="button"
                        onClick={onOpenStagingFolder}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:bg-white/[0.06]"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Open VortexMods folder
                      </button>
                    ) : null}
                    {onRefreshStaging ? (
                      <button
                        type="button"
                        onClick={onRefreshStaging}
                        className="inline-flex items-center gap-1.5 rounded-md border border-cyan-300/15 bg-cyan-300/[0.055] px-2.5 py-1.5 text-[10px] font-semibold text-cyan-100/60 hover:bg-cyan-300/[0.09]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh staged mods
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <details className="mt-3 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold text-white/50">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-200/55" />
          Privacy, credentials & download safety
        </summary>
        <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-white/45">
          <p>
            Your API key is held only in the GameAtlas process, sent only to the Nexus Mods API over HTTPS, and cleared when you disconnect or exit. GameAtlas does not write it to disk or include it in logs.
          </p>
          <p>
            Mod Manager Download links can contain short-lived Nexus credentials. They remain in memory only until the download succeeds, you dismiss the request, or GameAtlas exits; the credentials are never displayed or logged.
          </p>
          <p>
            Archives are downloaded directly from a Nexus-provided HTTPS mirror into VortexMods. GameAtlas verifies the archive signature and applies path, link, entry-count, and size checks before previewing it. Downloaded installers and scripts are never executed automatically.
          </p>
          <p>
            Metadata and quota requests occur when you look up, download, refresh, or check mods, plus one update check after a connected managed library loads. Public releases will replace testing-only personal-key entry with the Nexus-approved application sign-in flow.
          </p>
        </div>
      </details>
    </div>
  );
}
