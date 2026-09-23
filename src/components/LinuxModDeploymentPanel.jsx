import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  ExternalLink,
  FileArchive,
  Folder,
  FolderInput,
  FolderOpen,
  GitMerge,
  List,
  Loader2,
  PackagePlus,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  Wrench,
} from "lucide-react";
import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import {
  useEffect,
  useState,
} from "react";

import {
  activateLinuxModProfile,
  createLinuxModProfile,
  deleteLinuxModProfile,
  deployLinuxMod,
  getLinuxModDeploymentStatus,
  moveLinuxModPriority,
  pickLinuxModSource,
  prepareLinuxStagedMod,
  removeLinuxModDeployment,
  purgeLinuxModLibrary,
  redeployLinuxModLibrary,
  renameLinuxModProfile,
  repairLinuxModLibrary,
  setLinuxModEnabled,
  updateLinuxModMetadata,
  upgradeLinuxMod,
  verifyLinuxModLibrary,
} from "../services/linuxModDeployment";

import {
  openGamePath,
} from "../services/pathActions";

import NexusIntegrationPanel from "./NexusIntegrationPanel";
import LinuxDependencyNotice, {
  LINUX_DEPENDENCIES,
} from "./LinuxDependencyNotice";
import LinuxActionStatus from "./LinuxActionStatus";

import {
  checkNexusModUpdates,
  downloadNexusFile,
  getNexusAccountStatus,
} from "../services/nexusIntegration";


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


function remainingNexusQuota(
  account
) {
  const known = [
    account?.hourlyRemaining,
    account?.dailyRemaining,
  ].filter(
    (value) => Number.isFinite(value)
  );
  return known.length > 0
    ? Math.min(...known)
    : null;
}


function announceNexusDownloadStage(
  downloadId,
  phase
) {
  if (!downloadId) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(
      "gameatlas:nexus-download-stage",
      {
        detail: {
          downloadId,
          phase,
        },
      }
    )
  );
}


function focusDeploymentPreview() {
  window.requestAnimationFrame(
    () => window.requestAnimationFrame(
      () => {
        const target = document.getElementById(
          "linux-mod-deployment-preview"
        );
        target?.scrollIntoView({
          behavior:
            window.matchMedia?.(
              "(prefers-reduced-motion: reduce)"
            ).matches
              ? "auto"
              : "smooth",
          block: "start",
        });
        target?.focus({
          preventScroll: true,
        });
      }
    )
  );
}


function NexusUpdateStatus({
  deployment,
  update,
  isPremium,
  busy,
  action,
  onSelect,
  onReview,
}) {
  if (!update) {
    return null;
  }
  if (update.status === "current") {
    return (
      <div className="mt-2 text-[10px] text-emerald-100/38">
        Nexus check: no newer supported archives were found in the installed file&apos;s category.
      </div>
    );
  }
  if (update.status === "current-file-missing") {
    return (
      <div className="mt-2 rounded-md border border-amber-400/10 bg-amber-400/[0.035] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100/45">
        <div>{update.message}</div>
        <button
          type="button"
          onClick={() => onReview(update, null)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300/15 px-2.5 py-1.5 text-[9px] font-semibold text-amber-100/55 hover:bg-amber-300/[0.06]"
        >
          <ExternalLink className="h-3 w-3" />
          Review mod on Nexus
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-violet-400/15 bg-violet-400/[0.04] p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-100/55">
        Newer files in the same Nexus category
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-white/30">
        {update.message}
      </div>
      {update.currentFile ? (
        <div className="mt-2 rounded-md border border-cyan-300/10 bg-cyan-300/[0.025] px-2.5 py-2">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-cyan-100/45">
            Installed Nexus file
          </div>
          <div className="mt-1 break-words text-[10px] font-semibold text-white/48">
            {update.currentFile.name || `File ${update.currentFile.fileId}`}
          </div>
          <div className="mt-0.5 break-all font-mono text-[9px] text-white/28">
            {update.currentFile.fileName || "Filename unavailable"}
          </div>
          <div className="mt-1 text-[9px] text-white/25">
            {update.currentFile.categoryName || "Uncategorized"} · {update.currentFile.version ? `v${update.currentFile.version} · ` : ""}{formatBytes(update.currentFile.sizeBytes)} · uploaded {formatDate(update.currentFile.uploadedUnix)}
          </div>
        </div>
      ) : null}
      <div className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1">
        {update.candidates.map((candidate) => (
          <div
            key={candidate.fileId}
            className="flex min-w-0 flex-col gap-2 rounded-md border border-white/[0.06] bg-black/10 px-2.5 py-2"
          >
            <div className="min-w-0">
              <div className="break-words text-[10px] font-semibold text-white/50">
                {candidate.name || candidate.fileName}
              </div>
              <div className="mt-0.5 break-all font-mono text-[9px] text-white/28">
                {candidate.fileName || "Filename unavailable"}
              </div>
              <div className="mt-0.5 text-[9px] text-white/25">
                {candidate.categoryName || "Uncategorized"} · {candidate.version ? `v${candidate.version} · ` : ""}{formatBytes(candidate.sizeBytes)} · uploaded {formatDate(candidate.uploadedUnix)}
              </div>
              <div className="mt-1 text-[9px] leading-relaxed text-amber-100/42">
                Newer upload in the same category; compatibility is not guaranteed. Review its description and requirements on Nexus before replacing the installed file.
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onReview(update, candidate)}
                className="inline-flex min-w-0 w-full items-center justify-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-center text-[9px] font-semibold text-white/45 hover:bg-white/[0.05]"
              >
                <ExternalLink className="h-3 w-3" />
                Review on Nexus
              </button>
              <button
                type="button"
                onClick={() => onSelect(deployment, candidate)}
                disabled={busy}
                className="inline-flex min-w-0 w-full items-center justify-center gap-1.5 rounded-md border border-violet-300/15 bg-violet-300/[0.06] px-2.5 py-1.5 text-center text-[9px] font-semibold leading-tight text-violet-100/60 hover:bg-violet-300/[0.10] disabled:opacity-35"
              >
                {action === `upgrade-${deployment.id}-${candidate.fileId}` ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isPremium ? (
                  <Download className="h-3 w-3" />
                ) : (
                  <FolderOpen className="h-3 w-3" />
                )}
                <span className="min-w-0 whitespace-normal break-words">
                  {isPremium ? "Download & prepare" : "Choose browser download"}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
    activeView,
    setActiveView,
  ] = useState("mods");
  const [
    preview,
    setPreview,
  ] = useState(null);
  const [
    modName,
    setModName,
  ] = useState("");
  const [
    pendingNexusMetadata,
    setPendingNexusMetadata,
  ] = useState(null);
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
    batchInstalling,
    setBatchInstalling,
  ] = useState(false);
  const [
    selectedPaths,
    setSelectedPaths,
  ] = useState([]);
  const [
    preparingPath,
    setPreparingPath,
  ] = useState(null);
  const [
    removingId,
    setRemovingId,
  ] = useState(null);
  const [
    togglingId,
    setTogglingId,
  ] = useState(null);
  const [
    movingId,
    setMovingId,
  ] = useState(null);
  const [
    upgradeTargetId,
    setUpgradeTargetId,
  ] = useState(null);
  const [
    editingMetadataId,
    setEditingMetadataId,
  ] = useState(null);
  const [
    metadataDraft,
    setMetadataDraft,
  ] = useState({
    name: "",
    version: "",
    author: "",
    website: "",
    notes: "",
  });
  const [
    savingMetadataId,
    setSavingMetadataId,
  ] = useState(null);
  const [
    libraryAction,
    setLibraryAction,
  ] = useState(null);
  const [
    profileAction,
    setProfileAction,
  ] = useState(null);
  const [
    selectedProfileId,
    setSelectedProfileId,
  ] = useState("");
  const [
    verification,
    setVerification,
  ] = useState(null);
  const [
    message,
    setMessage,
  ] = useState(null);
  const [
    error,
    setError,
  ] = useState(null);
  const [
    nexusUpdateReport,
    setNexusUpdateReport,
  ] = useState(null);
  const [
    nexusUpdateAction,
    setNexusUpdateAction,
  ] = useState(null);
  const [
    nexusAccountStatus,
    setNexusAccountStatus,
  ] = useState(null);
  const [
    nexusAutoCheckKey,
    setNexusAutoCheckKey,
  ] = useState("");


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
      setPendingNexusMetadata(null);
      setSelectedPaths([]);
      setUpgradeTargetId(null);
      setEditingMetadataId(null);
      setVerification(null);
      setMessage(null);
      setError(null);
      setNexusUpdateReport(null);
      setActiveView("mods");
      loadStatus();
    },
    [
      isLinux,
      game?.id,
      game?.name,
      game?.installPath,
    ]
  );


  useEffect(
    () => {
      const trackedKey = status?.deployments
        ?.filter(
          (deployment) => deployment.nexusGameDomain
            && deployment.nexusModId
            && deployment.nexusFileId
        )
        .map(
          (deployment) => `${deployment.id}:${deployment.nexusFileId}`
        )
        .sort()
        .join("|")
        ?? "";
      const quotaRemaining = remainingNexusQuota(nexusAccountStatus);
      const automaticCheckAllowed = quotaRemaining === null
        || quotaRemaining > 10;
      if (
        nexusAccountStatus?.connected
        && trackedKey
        && automaticCheckAllowed
        && nexusAutoCheckKey !== trackedKey
      ) {
        setNexusAutoCheckKey(trackedKey);
        checkNexusUpdates();
      }
      if (!nexusAccountStatus?.connected) {
        if (nexusUpdateReport) {
          setNexusUpdateReport(null);
        }
        if (nexusAutoCheckKey) {
          setNexusAutoCheckKey("");
        }
      }
    },
    [
      nexusAccountStatus?.connected,
      nexusAccountStatus?.hourlyRemaining,
      nexusAccountStatus?.dailyRemaining,
      status?.deployments,
      nexusUpdateReport,
      nexusAutoCheckKey,
    ]
  );


  useEffect(
    () => {
      setSelectedProfileId(
        status?.activeProfileId
        ?? ""
      );
    },
    [status?.activeProfileId]
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
        setActiveView("downloads");
        setPreview(next);
        if (!upgradeTargetId) {
          setPendingNexusMetadata(null);
        }
        setModName(
          next.suggestedName
          ?? ""
        );
        setSelectedPaths(
          (current) => current.includes(next.sourcePath)
            ? current
            : [
                ...current,
                next.sourcePath,
              ]
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
      if (!upgradeTargetId) {
        setPendingNexusMetadata(null);
      }
      setModName(
        next.suggestedName
        ?? item.name
        ?? ""
      );
      setSelectedPaths(
        (current) => current.includes(next.sourcePath)
          ? current
          : [
              ...current,
              next.sourcePath,
            ]
      );
      if (item.kind === "zip" || item.kind === "rar" || item.kind === "7z") {
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


  async function prepareNexusArchive({
    download,
    mod,
    file,
    upgradeDeployment = null,
  }) {
    setActiveView("downloads");
    setPreparingPath(download.path);
    setMessage(null);
    setError(null);
    announceNexusDownloadStage(
      download.downloadId,
      "preparing"
    );
    try {
      const next = await prepareLinuxStagedMod(
        game,
        download.path
      );
      setPreview(next);
      setModName(
        (
          mod.name
          || next.suggestedName
          || file.name
          || "Nexus Mod"
        ).slice(0, 120)
      );
      setPendingNexusMetadata({
        version:
          (
            file.version
            || mod.version
            || ""
          ).slice(0, 80),
        author: (mod.author ?? "").slice(0, 120),
        website: mod.modPageUrl ?? "",
        notes: `Nexus Mods file ${file.fileId}${file.categoryName ? ` • ${file.categoryName}` : ""}`,
        nexusGameDomain: mod.gameDomain,
        nexusModId: mod.modId,
        nexusFileId: file.fileId,
      });
      setUpgradeTargetId(
        upgradeDeployment?.id
        ?? null
      );
      setSelectedPaths(
        (current) => current.includes(next.sourcePath)
          ? current
          : [
              ...current,
              next.sourcePath,
            ]
      );
      setMessage(
        upgradeDeployment
          ? `${download.fileName} was downloaded and safely extracted. Review the preview, then apply the transactional upgrade to ${upgradeDeployment.name}.`
          : `${download.fileName} was downloaded and safely extracted. Review the deployment preview; its Nexus metadata will be saved when installed.`
      );
      announceNexusDownloadStage(
        download.downloadId,
        "ready"
      );
      focusDeploymentPreview();
    } catch (prepareError) {
      announceNexusDownloadStage(
        download.downloadId,
        "preparation-error"
      );
      setError(
        `The Nexus archive was downloaded, but preparation failed: ${String(prepareError)}`
      );
      throw prepareError;
    } finally {
      await loadStatus();
      setPreparingPath(null);
    }
  }


  async function checkNexusUpdates() {
    const tracked = status?.deployments?.filter(
      (deployment) => deployment.nexusGameDomain
        && deployment.nexusModId
        && deployment.nexusFileId
    ) ?? [];
    if (tracked.length === 0) {
      return;
    }
    setNexusUpdateAction("check");
    setMessage(null);
    setError(null);
    try {
      const report = await checkNexusModUpdates(tracked);
      setNexusUpdateReport(report);
      setNexusAccountStatus(
        (current) => ({
          ...current,
          dailyRemaining: report.dailyRemaining,
          hourlyRemaining: report.hourlyRemaining,
          dailyReset: report.dailyReset,
          hourlyReset: report.hourlyReset,
        })
      );
      setMessage(
        report.updateCount > 0
          ? `Checked ${report.checkedCount} Nexus mod${report.checkedCount === 1 ? "" : "s"}; ${report.updateCount} ${report.updateCount === 1 ? "has" : "have"} newer files in the installed file's category to review.`
          : `Checked ${report.checkedCount} Nexus mod${report.checkedCount === 1 ? "" : "s"}; no newer supported archives were found in the installed files' categories.`
      );
    } catch (updateError) {
      setError(String(updateError));
      try {
        setNexusAccountStatus(await getNexusAccountStatus());
      } catch {
        // Preserve the actionable update-check error if local status cannot be read.
      }
    } finally {
      setNexusUpdateAction(null);
    }
  }


  async function reviewNexusUpdate(
    update,
    candidate
  ) {
    const fileTarget = candidate?.fileId
      ? `?tab=files&file_id=${candidate.fileId}`
      : "?tab=files";
    try {
      await openUrl(
        `https://www.nexusmods.com/${update.gameDomain}/mods/${update.modId}${fileTarget}`
      );
    } catch (openError) {
      setError(String(openError));
    }
  }


  async function prepareNexusUpdate(
    deployment,
    candidate
  ) {
    const tracked = nexusUpdateReport?.results?.find(
      (result) => result.deploymentId === deployment.id
    );
    if (!tracked) {
      return;
    }
    const metadata = {
      version: (candidate.version || deployment.version || "").slice(0, 80),
      author: (deployment.author ?? "").slice(0, 120),
      website: deployment.website
        || `https://www.nexusmods.com/${tracked.gameDomain}/mods/${tracked.modId}`,
      notes: `Nexus Mods file ${candidate.fileId}${candidate.categoryName ? ` • ${candidate.categoryName}` : ""}`,
      nexusGameDomain: tracked.gameDomain,
      nexusModId: tracked.modId,
      nexusFileId: candidate.fileId,
    };
    if (!nexusUpdateReport?.isPremium) {
      try {
        await openUrl(
          `https://www.nexusmods.com/${tracked.gameDomain}/mods/${tracked.modId}?tab=files&file_id=${candidate.fileId}`
        );
        setUpgradeTargetId(deployment.id);
        setActiveView("downloads");
        setPreview(null);
        setPendingNexusMetadata(metadata);
        setMessage(
          `Download ${candidate.fileName || candidate.name} in your browser, place it in VortexMods, select Refresh, then Extract & Preview. GameAtlas will retain this update selection for the transactional upgrade.`
        );
      } catch (openError) {
        setError(String(openError));
      }
      return;
    }

    setNexusUpdateAction(`upgrade-${deployment.id}-${candidate.fileId}`);
    setMessage(null);
    setError(null);
    try {
      const downloadMetadata = {
        name: deployment.name,
        author: metadata.author,
        version: metadata.version,
        modPageUrl: metadata.website,
        gameDomain: tracked.gameDomain,
        modId: tracked.modId,
      };
      const download = await downloadNexusFile(
        game,
        downloadMetadata,
        candidate
      );
      await prepareNexusArchive({
        download,
        mod: downloadMetadata,
        file: candidate,
        upgradeDeployment: deployment,
      });
    } catch (updateError) {
      setError(String(updateError));
    } finally {
      setNexusUpdateAction(null);
    }
  }


  async function deploy() {
    const upgradeTarget = status?.deployments?.find(
      (deployment) => deployment.id === upgradeTargetId
    );
    if (!preview || (!upgradeTarget && !modName.trim())) {
      return;
    }

    const overwriteText =
      preview.existingFileCount > 0
        ? `\n\n${preview.existingFileCount} existing game file${preview.existingFileCount === 1 ? "" : "s"} will be backed up and replaced.`
        : "";
    const confirmed =
      window.confirm(
        upgradeTarget
          ? `Upgrade “${upgradeTarget.name}” with this ${preview.fileCount}-file payload?\n\n${pendingNexusMetadata ? "Its Nexus version and file identity will advance after the transaction succeeds." : "Its metadata will be preserved."} Its enabled state, profiles, and priority will be preserved. Fully exit the game before continuing.`
          : `Deploy “${modName.trim()}” into this game?${overwriteText}\n\nFully exit the game before continuing.`
      );

    if (!confirmed) {
      return;
    }

    setDeploying(true);
    setMessage(null);
    setError(null);

    try {
      const result = upgradeTarget
        ? await upgradeLinuxMod(
          game,
          upgradeTarget.id,
            preview.sourcePath,
            pendingNexusMetadata
          )
        : await deployLinuxMod(
            game,
            preview.sourcePath,
            modName.trim(),
            pendingNexusMetadata
          );
      setMessage(
        result.message
      );
      setPreview(null);
      setModName("");
      setPendingNexusMetadata(null);
      setNexusUpdateReport(null);
      setUpgradeTargetId(null);
      setSelectedPaths(
        (current) => current.filter(
          (path) => path !== preview.sourcePath
        )
      );
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


  function beginUpgrade(
    deployment
  ) {
    setActiveView("downloads");
    setUpgradeTargetId(deployment.id);
    setPreview(null);
    setModName("");
    setPendingNexusMetadata(null);
    setMessage(
      `Upgrading ${deployment.name}: preview an extracted folder or archive from the staging area, or select another folder.`
    );
    setError(null);
  }


  function beginMetadataEdit(
    deployment
  ) {
    setEditingMetadataId(deployment.id);
    setMetadataDraft({
      name: deployment.name ?? "",
      version: deployment.version ?? "",
      author: deployment.author ?? "",
      website: deployment.website ?? "",
      notes: deployment.notes ?? "",
    });
  }


  async function saveMetadata(
    deployment
  ) {
    setSavingMetadataId(deployment.id);
    setMessage(null);
    setError(null);
    try {
      const result = await updateLinuxModMetadata(
        game,
        deployment.id,
        metadataDraft
      );
      setMessage(result.message);
      setEditingMetadataId(null);
      await loadStatus();
    } catch (metadataError) {
      setError(String(metadataError));
    } finally {
      setSavingMetadataId(null);
    }
  }


  function toggleSelected(
    item
  ) {
    if (item.kind !== "folder") {
      return;
    }
    setSelectedPaths(
      (current) => current.includes(item.path)
        ? current.filter(
            (path) => path !== item.path
          )
        : [
            ...current,
            item.path,
          ]
    );
  }


  async function installSelected() {
    const selected =
      selectedPaths.map(
        (path) => status?.stagedItems?.find(
          (item) => item.kind === "folder"
            && item.path === path
        )
      ).filter(
        (item) => item
          && !status.deployments.some(
            (deployment) => deployment.sourcePath === item.path
          )
      )
      ?? [];

    if (selected.length === 0) {
      return;
    }

    const confirmed =
      window.confirm(
        `Install and enable ${selected.length} selected mod${selected.length === 1 ? "" : "s"} in this order?\n\n${selected.map((item, index) => `${index + 1}. ${item.name}`).join("\n")}\n\nLater mods receive higher priority. Fully exit the game before continuing.`
      );

    if (!confirmed) {
      return;
    }

    setBatchInstalling(true);
    setMessage(null);
    setError(null);
    let installed = 0;

    try {
      for (const item of selected) {
        const nextPreview =
          await prepareLinuxStagedMod(
            game,
            item.path
          );
        await deployLinuxMod(
          game,
          nextPreview.sourcePath,
          nextPreview.suggestedName
            ?? item.name
        );
        installed += 1;
      }
      setMessage(
        `Installed and enabled ${installed} mod${installed === 1 ? "" : "s"}. Later selections have higher priority.`
      );
      setPreview(null);
      setModName("");
      setSelectedPaths([]);
    } catch (batchError) {
      setError(
        `${installed > 0 ? `${installed} mod${installed === 1 ? " was" : "s were"} installed before the batch stopped. ` : ""}${String(batchError)}`
      );
      setSelectedPaths(
        selected.slice(installed).map(
          (item) => item.path
        )
      );
    } finally {
      await loadStatus();
      setBatchInstalling(false);
    }
  }


  async function removeDeployment(
    deployment
  ) {
    const confirmed =
      window.confirm(
        deployment.enabled
          ? `Uninstall “${deployment.name}”?\n\nGameAtlas will remove its deployed files and restore ${deployment.overwrittenFileCount} backed-up file${deployment.overwrittenFileCount === 1 ? "" : "s"}. Fully exit the game first.`
          : `Permanently remove “${deployment.name}” from the managed library?`
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


  async function toggleDeployment(
    deployment
  ) {
    const nextEnabled =
      !deployment.enabled;
    const confirmed =
      window.confirm(
        `${nextEnabled ? "Enable" : "Disable"} “${deployment.name}”?\n\nGameAtlas will transactionally rebuild affected mod files. Fully exit the game before continuing.`
      );

    if (!confirmed) {
      return;
    }

    setTogglingId(
      deployment.id
    );
    setMessage(null);
    setError(null);

    try {
      const result =
        await setLinuxModEnabled(
          game,
          deployment.id,
          nextEnabled
        );
      setMessage(
        result.message
      );
      await loadStatus();
    } catch (toggleError) {
      setError(
        String(
          toggleError
        )
      );
    } finally {
      setTogglingId(null);
    }
  }


  async function movePriority(
    deployment,
    direction
  ) {
    const confirmed =
      window.confirm(
        `Move “${deployment.name}” one priority level ${direction}?\n\nGameAtlas will rebuild all enabled mod layers. Higher-priority mods win overlapping files. Fully exit the game before continuing.`
      );

    if (!confirmed) {
      return;
    }

    setMovingId(
      deployment.id
    );
    setMessage(null);
    setError(null);

    try {
      const result =
        await moveLinuxModPriority(
          game,
          deployment.id,
          direction
        );
      setMessage(
        result.message
      );
      await loadStatus();
    } catch (moveError) {
      setError(
        String(
          moveError
        )
      );
    } finally {
      setMovingId(null);
    }
  }


  async function verifyLibrary() {
    setLibraryAction("verify");
    setMessage(null);
    setError(null);
    try {
      const report =
        await verifyLinuxModLibrary(
          game
        );
      setVerification(report);
      setMessage(report.summary);
    } catch (verifyError) {
      setError(String(verifyError));
    } finally {
      setLibraryAction(null);
    }
  }


  async function runLibraryAction(
    action
  ) {
    const labels = {
      purge: "Purge all deployed mod files while preserving enabled selections and managed payloads?",
      redeploy: "Redeploy every enabled mod in priority order?",
      repair: `Repair ${verification?.repairableCount ?? 0} missing or changed winning file${verification?.repairableCount === 1 ? "" : "s"} from preserved payloads?`,
    };
    const confirmed =
      window.confirm(
        `${labels[action]}\n\nFully exit the game before continuing.`
      );
    if (!confirmed) {
      return;
    }

    setLibraryAction(action);
    setMessage(null);
    setError(null);
    try {
      const handlers = {
        purge: purgeLinuxModLibrary,
        redeploy: redeployLinuxModLibrary,
        repair: repairLinuxModLibrary,
      };
      const result =
        await handlers[action](game);
      setMessage(result.message);
      await loadStatus();
      const report =
        await verifyLinuxModLibrary(game);
      setVerification(report);
    } catch (actionError) {
      setError(String(actionError));
    } finally {
      setLibraryAction(null);
    }
  }


  async function createProfile() {
    const name = window.prompt(
      "Name this profile. It will copy the current enabled mods and priority order.",
      "New Profile"
    )?.trim();
    if (!name) {
      return;
    }
    setProfileAction("create");
    setMessage(null);
    setError(null);
    try {
      const result = await createLinuxModProfile(game, name);
      setMessage(result.message);
      await loadStatus();
    } catch (profileError) {
      setError(String(profileError));
    } finally {
      setProfileAction(null);
    }
  }


  async function renameProfile() {
    const profile = status?.profiles?.find(
      (candidate) => candidate.id === selectedProfileId
    );
    if (!profile) {
      return;
    }
    const name = window.prompt(
      "Enter a new name for this profile.",
      profile.name
    )?.trim();
    if (!name || name === profile.name) {
      return;
    }
    setProfileAction("rename");
    setMessage(null);
    setError(null);
    try {
      const result = await renameLinuxModProfile(game, profile.id, name);
      setMessage(result.message);
      await loadStatus();
    } catch (profileError) {
      setError(String(profileError));
    } finally {
      setProfileAction(null);
    }
  }


  async function deleteProfile() {
    const profile = status?.profiles?.find(
      (candidate) => candidate.id === selectedProfileId
    );
    if (!profile || profile.active) {
      return;
    }
    const confirmed = window.confirm(
      `Delete the “${profile.name}” profile?\n\nThis removes only the saved setup. It does not uninstall any managed mods.`
    );
    if (!confirmed) {
      return;
    }
    setProfileAction("delete");
    setMessage(null);
    setError(null);
    try {
      const result = await deleteLinuxModProfile(game, profile.id);
      setMessage(result.message);
      await loadStatus();
    } catch (profileError) {
      setError(String(profileError));
    } finally {
      setProfileAction(null);
    }
  }


  async function activateProfile() {
    const profile = status?.profiles?.find(
      (candidate) => candidate.id === selectedProfileId
    );
    if (!profile || profile.active) {
      return;
    }
    const confirmed = window.confirm(
      `Activate “${profile.name}”?\n\nGameAtlas will transactionally apply its enabled mods and saved priority order. Fully exit the game before continuing.`
    );
    if (!confirmed) {
      return;
    }
    setProfileAction("activate");
    setMessage(null);
    setError(null);
    try {
      const result = await activateLinuxModProfile(game, profile.id);
      setMessage(result.message);
      setVerification(null);
      await loadStatus();
    } catch (profileError) {
      setError(String(profileError));
    } finally {
      setProfileAction(null);
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
    || batchInstalling
    || Boolean(
      togglingId
    )
    || Boolean(
      movingId
    )
    || Boolean(
      libraryAction
    )
    || Boolean(
      profileAction
    )
    || Boolean(
      removingId
    )
    || Boolean(
      savingMetadataId
    )
    || Boolean(
      nexusUpdateAction
    );
  const selectedCount =
    selectedPaths.filter(
      (path) => status?.stagedItems?.some(
        (item) => item.kind === "folder"
          && item.path === path
      )
        && !status?.deployments?.some(
          (deployment) => deployment.sourcePath === path
        )
    ).length
    ?? 0;
  const enabledCount =
    status?.deployments?.filter(
      (deployment) => deployment.enabled
    ).length
    ?? 0;
  const activeProfile =
    status?.profiles?.find(
      (profile) => profile.id === status.activeProfileId
    )
    ?? status?.profiles?.find(
      (profile) => profile.active
    )
    ?? null;
  const views = [
    {
      id: "mods",
      label: "Mods",
      icon: List,
      count: status?.deployments?.length ?? 0,
    },
    {
      id: "downloads",
      label: "Downloads & Staging",
      icon: Download,
      count: status?.stagedItems?.length ?? 0,
    },
    {
      id: "conflicts",
      label: "Rules & Conflicts",
      icon: GitMerge,
      count: status?.totalConflictCount ?? 0,
    },
    {
      id: "profiles",
      label: "Profiles",
      icon: UserRoundCog,
      count: status?.profiles?.length ?? 0,
    },
  ];

  function handleViewKeyDown(
    event,
    index
  ) {
    const keys = [
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ];

    if (!keys.includes(event.key)) {
      return;
    }

    event.preventDefault();

    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? views.length - 1
        : event.key === "ArrowRight"
          ? (index + 1) % views.length
          : (index - 1 + views.length) % views.length;
    const next = views[nextIndex];

    setActiveView(next.id);
    window.requestAnimationFrame(() => {
      document.querySelector(
        `[data-linux-mod-tab="${next.id}"]`
      )?.focus();
    });
  }


  return (
    <div
      aria-busy={busy}
      className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-black/10"
    >
      <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
            <PackagePlus className="h-5 w-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-white/75">
                GameAtlas Linux Mod Manager
              </div>
              <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.05] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200/60">
                Linux only
              </span>
            </div>

            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Drop mod folders, ZIP archives, RAR archives, or 7z archives into this game's VortexMods staging folder. GameAtlas preserves installed payloads so mods can be enabled and disabled safely.
            </div>

            {status ? (
              <div className="mt-2 text-xs text-white/28">
                {status.summary}
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


      <LinuxActionStatus
        type="error"
        message={error}
        className="mx-4 mt-3"
      />

      <LinuxActionStatus
        type="success"
        message={message}
        className="mx-4 mt-3"
      />


      <div className="border-b border-white/[0.06] bg-white/[0.015] p-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/25">
              Active profile
            </div>
            <div className="mt-1 truncate text-xs font-semibold text-violet-100/65">
              {activeProfile?.name ?? "Default"}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/25">
              Enabled mods
            </div>
            <div className="mt-1 text-xs font-semibold text-white/65">
              {enabledCount} of {status?.deployments?.length ?? 0}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/25">
              Deployment
            </div>
            <div className={`mt-1 text-xs font-semibold ${status?.purged ? "text-amber-200/65" : "text-emerald-200/65"}`}>
              {status?.purged ? "Purged · redeploy pending" : enabledCount > 0 ? "Deployed" : "No enabled mods"}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/25">
              File conflicts
            </div>
            <div className={`mt-1 text-xs font-semibold ${status?.totalConflictCount > 0 ? "text-amber-200/65" : "text-white/65"}`}>
              {(status?.totalConflictCount ?? 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Linux Mod Manager views"
          className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/15 p-1"
        >
          {views.map((view) => {
            const ViewIcon = view.icon;
            const selected = activeView === view.id;

            return (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`linux-mod-view-${view.id}`}
                tabIndex={selected ? 0 : -1}
                data-linux-mod-tab={view.id}
                onClick={() => setActiveView(view.id)}
                onKeyDown={(event) => handleViewKeyDown(event, views.indexOf(view))}
                className={`inline-flex min-w-max flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${selected ? "bg-cyan-500/10 text-cyan-100/80 shadow-sm" : "text-white/40 hover:bg-white/[0.04] hover:text-white/65"}`}
              >
                <ViewIcon className="h-3.5 w-3.5" />
                {view.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${selected ? "bg-cyan-300/10 text-cyan-100/60" : "bg-white/[0.05] text-white/30"}`}>
                  {view.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>


      <div
        id="linux-mod-view-downloads"
        role="tabpanel"
        aria-label="Downloads and staging"
        hidden={activeView !== "downloads"}
      >
      <NexusIntegrationPanel
        game={game}
        onArchiveReady={prepareNexusArchive}
        onAccountStatusChange={setNexusAccountStatus}
        onOpenStagingFolder={status?.stagingPath
          ? () => openFolder(status.stagingPath)
          : null
        }
        onRefreshStaging={loadStatus}
      />


      {status ? (
        <div className="border-b border-white/[0.06] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-white/30">
                Staged mods
              </div>
              {upgradeTargetId ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-violet-100/50">
                  <span>
                    Choose the replacement payload for {status.deployments.find((deployment) => deployment.id === upgradeTargetId)?.name}.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUpgradeTargetId(null);
                      setPendingNexusMetadata(null);
                      setPreview(null);
                    }}
                    disabled={deploying}
                    className="font-semibold uppercase tracking-wide text-white/35 hover:text-white/60"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}
              <div className="mt-1 break-all font-mono text-[10px] text-white/22">
                {status.stagingPath}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="text-[10px] text-white/25">
                Preview folders to add them to the install queue.
              </div>
              {selectedCount > 0 ? (
                <button
                  type="button"
                  onClick={installSelected}
                  disabled={busy || status?.purged || Boolean(upgradeTargetId)}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2 text-xs font-semibold text-emerald-100/75 hover:bg-emerald-400/[0.13] disabled:opacity-35"
                >
                  {batchInstalling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <PackagePlus className="h-3.5 w-3.5" />
                  )}
                  Install Selected ({selectedCount})
                </button>
              ) : null}
            </div>
          </div>

          {status.rarSupported ? (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-100/45">
              <CheckCircle2 className="h-3 w-3" />
              RAR/7z extraction available through {status.rarProvider}
            </div>
          ) : (
            <div className="mt-3 max-w-2xl">
              <LinuxDependencyNotice
                dependency={LINUX_DEPENDENCIES.unar}
                onRefresh={loadStatus}
                refreshing={loading}
                compact
              />
            </div>
          )}

          {status.stagedItems.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {status.stagedItems.map((item) => {
                const installed =
                  status.deployments.some(
                    (deployment) => deployment.sourcePath === item.path
                  );
                const selected =
                  selectedPaths.includes(item.path);
                return (
                <div key={item.path} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${selected ? "border-emerald-400/20 bg-emerald-400/[0.035]" : "border-white/[0.07] bg-black/10"}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    {item.kind === "zip" || item.kind === "rar" || item.kind === "7z" ? (
                      <FileArchive className="h-4 w-4 shrink-0 text-violet-300/65" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0 text-cyan-300/65" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white/62">
                        {item.name}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-white/25">
                        {item.kind === "zip" || item.kind === "rar" || item.kind === "7z"
                          ? `${item.kind.toUpperCase()} archive • ${formatBytes(item.sizeBytes)}`
                          : "Extracted folder"
                        }
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.kind === "folder" ? (
                      <button
                        type="button"
                        onClick={() => toggleSelected(item)}
                        disabled={busy || installed || Boolean(upgradeTargetId)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold disabled:opacity-35 ${selected ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100/75" : "border-white/10 bg-white/[0.03] text-white/45 hover:bg-white/[0.06]"}`}
                      >
                        <PackagePlus className="h-3.5 w-3.5" />
                        {installed ? "Installed" : selected ? "Selected" : "Select"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => prepareStaged(item)}
                      disabled={busy || (installed && !upgradeTargetId) || ((item.kind === "rar" || item.kind === "7z") && !status.rarSupported)}
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-cyan-100/65 hover:bg-cyan-400/[0.10] disabled:opacity-35"
                    >
                      {preparingPath === item.path ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : item.kind === "zip" || item.kind === "rar" || item.kind === "7z" ? (
                        <FileArchive className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      )}
                      {item.kind === "zip" || item.kind === "rar" || item.kind === "7z"
                        ? "Extract & Preview"
                        : "Preview"
                      }
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center text-xs text-white/28">
              This staging folder is empty.
            </div>
          )}
        </div>
      ) : null}


      {preview ? (
        <div
          id="linux-mod-deployment-preview"
          tabIndex="-1"
          className="scroll-mt-16 border-b border-white/[0.06] p-4 outline-none"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/35">
            <ShieldCheck className="h-4 w-4 text-cyan-300/70" />
            Deployment preview
          </div>

          {upgradeTargetId ? (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-violet-400/15 bg-violet-400/[0.04] px-3 py-2.5 text-xs text-violet-100/60 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Upgrade target: <span className="font-semibold">{status?.deployments?.find((deployment) => deployment.id === upgradeTargetId)?.name}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setUpgradeTargetId(null);
                  setPendingNexusMetadata(null);
                  setPreview(null);
                }}
                disabled={deploying}
                className="text-[10px] font-semibold uppercase tracking-wide text-white/40 hover:text-white/65"
              >
                Cancel upgrade
              </button>
            </div>
          ) : null}

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

          {!upgradeTargetId ? (
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
          ) : null}

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
                disabled={deploying || (!upgradeTargetId && (!modName.trim() || status?.purged))}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-2 text-xs font-semibold text-emerald-100/75 hover:bg-emerald-400/[0.13] disabled:opacity-35"
              >
                {deploying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PackagePlus className="h-3.5 w-3.5" />
                )}
                {upgradeTargetId ? "Apply Upgrade" : "Install & Enable"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      </div>


      {activeView === "mods" || activeView === "profiles" ? (
      <div
        id={`linux-mod-view-${activeView}`}
        role="tabpanel"
        aria-label={activeView === "profiles" ? "Profiles" : "Mods"}
        className="p-4"
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/30">
            {activeView === "profiles" ? "Profiles" : "Mods"}
            {activeView === "mods" && status?.purged ? (
              <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.05] px-2 py-0.5 text-[9px] text-amber-100/55">
                Purged
              </span>
            ) : null}
          </div>
          {activeView === "mods"
          && status?.deployments?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {status.deployments.some((deployment) => deployment.nexusModId && deployment.nexusFileId) ? (
                <button
                  type="button"
                  onClick={checkNexusUpdates}
                  disabled={busy || remainingNexusQuota(nexusAccountStatus) === 0}
                  title={remainingNexusQuota(nexusAccountStatus) === 0 ? "Nexus API quota is exhausted." : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/15 bg-violet-400/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-violet-100/60 hover:bg-violet-400/[0.10] disabled:opacity-30"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${nexusUpdateAction === "check" ? "animate-spin" : ""}`} />
                  Check Nexus Updates
                </button>
              ) : null}
              <button
                type="button"
                onClick={verifyLibrary}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:bg-white/[0.07] disabled:opacity-30"
              >
                {libraryAction === "verify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Verify
              </button>
              <button
                type="button"
                onClick={() => runLibraryAction("repair")}
                disabled={busy || !verification?.repairableCount || status?.purged}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.05] px-2.5 py-1.5 text-[10px] font-semibold text-cyan-100/60 hover:bg-cyan-400/[0.10] disabled:opacity-30"
              >
                {libraryAction === "repair" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                Repair
              </button>
              <button
                type="button"
                onClick={() => runLibraryAction("redeploy")}
                disabled={busy || !status.deployments.some((deployment) => deployment.enabled)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[10px] font-semibold text-emerald-100/70 hover:bg-emerald-400/[0.13] disabled:opacity-30"
              >
                {libraryAction === "redeploy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Deploy Mods
              </button>
              {!status?.purged ? (
                <button
                  type="button"
                  onClick={() => runLibraryAction("purge")}
                  disabled={busy || !status.deployments.some((deployment) => deployment.enabled)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.055] px-2.5 py-1.5 text-[10px] font-semibold text-amber-100/65 hover:bg-amber-400/[0.10] disabled:opacity-30"
                >
                  {libraryAction === "purge" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  Purge Mods
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {activeView === "profiles"
        && status?.profiles?.length > 0 ? (
          <div className="mb-3 rounded-lg border border-violet-400/10 bg-violet-400/[0.025] p-3">
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/25">Active</div>
                <div className="mt-1 truncate text-xs font-semibold text-violet-100/65">{activeProfile?.name ?? "Default"}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/25">Profiles</div>
                <div className="mt-1 text-xs font-semibold text-white/65">{status.profiles.length}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-white/25">Enabled in active profile</div>
                <div className="mt-1 text-xs font-semibold text-emerald-100/65">{enabledCount}</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <label htmlFor="linux-mod-profile" className="text-[10px] font-semibold uppercase tracking-wide text-violet-100/45">
                  Mod profile
                </label>
                <div className="mt-1 text-[10px] leading-relaxed text-white/27">
                  Profiles remember enabled mods and their low-to-high priority order. Changes automatically update the active profile.
                </div>
                <select
                  id="linux-mod-profile"
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                  disabled={busy}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/65 outline-none focus:border-violet-400/30 disabled:opacity-35"
                >
                  {status.profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}{profile.active ? " — Active" : ""} ({profile.enabledModCount} enabled)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={activateProfile}
                  disabled={busy || !selectedProfileId || selectedProfileId === status.activeProfileId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-2 text-[10px] font-semibold text-emerald-100/70 hover:bg-emerald-400/[0.12] disabled:opacity-30"
                >
                  {profileAction === "activate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                  Activate
                </button>
                <button
                  type="button"
                  onClick={createProfile}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/15 bg-violet-400/[0.05] px-2.5 py-2 text-[10px] font-semibold text-violet-100/65 hover:bg-violet-400/[0.10] disabled:opacity-30"
                >
                  {profileAction === "create" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackagePlus className="h-3.5 w-3.5" />}
                  New
                </button>
                <button
                  type="button"
                  onClick={renameProfile}
                  disabled={busy || !selectedProfileId}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] font-semibold text-white/50 hover:bg-white/[0.07] disabled:opacity-30"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={deleteProfile}
                  disabled={busy || status.profiles.length <= 1 || selectedProfileId === status.activeProfileId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/15 bg-red-400/[0.04] px-2.5 py-2 text-[10px] font-semibold text-red-100/55 hover:bg-red-400/[0.09] disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeView === "mods"
        && verification ? (
          <div className={`mb-3 rounded-lg border p-3 ${verification.healthy ? "border-emerald-400/15 bg-emerald-400/[0.035]" : "border-amber-400/15 bg-amber-400/[0.04]"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className={`text-xs font-semibold ${verification.healthy ? "text-emerald-100/65" : "text-amber-100/65"}`}>
                {verification.summary}
              </div>
              <div className="text-[10px] text-white/28">
                {verification.modsChecked} mods • {verification.payloadFilesChecked} payload files • {verification.deployedFilesChecked} deployed winners
              </div>
            </div>
            {verification.findings.length > 0 ? (
              <div className="mt-2 max-h-52 space-y-1.5 overflow-auto">
                {verification.findings.map((finding, index) => (
                  <div key={`${finding.kind}-${finding.relativePath}-${index}`} className="rounded border border-white/[0.06] bg-black/10 px-2.5 py-2 text-[10px] text-white/35">
                    <span className="font-semibold uppercase tracking-wide text-white/45">{finding.kind}</span>
                    {" • "}{finding.modName}
                    {finding.relativePath ? <> {" • "}<span className="break-all font-mono">{finding.relativePath}</span></> : null}
                    <div className="mt-1 text-white/28">{finding.detail}{finding.repairable ? " GameAtlas can repair this file." : ""}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeView === "mods"
        && loading && !status ? (
          <div className="flex items-center gap-2 py-3 text-xs text-white/35">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading managed mod library…
          </div>
        ) : activeView === "mods"
        && status?.deployments?.length > 0 ? (
          <div className="space-y-2">
            {status.deployments.map((deployment) => (
              <div key={deployment.id} className="rounded-lg border border-white/[0.07] bg-black/10 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-white/68">{deployment.name}</div>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${deployment.enabled ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-200/60" : "border-white/10 bg-white/[0.03] text-white/35"}`}>
                        {deployment.enabled
                          ? status?.purged
                            ? `Enabled • Pending redeploy • Priority ${deployment.priority}`
                            : `Enabled • Priority ${deployment.priority}`
                          : "Disabled"
                        }
                      </span>
                      {!deployment.canToggle ? (
                        <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.04] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100/50">
                          Legacy
                        </span>
                      ) : null}
                      {deployment.nexusModId ? (
                        <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.05] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100/55">
                          Nexus #{deployment.nexusModId}
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
                      {deployment.conflictCount > 0 ? (
                        <>
                          {" • "}
                          <span className="text-amber-100/50">
                            {deployment.conflictCount} overlapping
                            {" • "}
                            {deployment.winningConflictCount} winning
                            {" • "}
                            {deployment.losingConflictCount} overridden
                          </span>
                        </>
                      ) : null}
                    </div>
                    <div className="mt-1.5 break-all font-mono text-[10px] text-white/20">
                      {deployment.sourcePath}
                    </div>
                    {(deployment.version || deployment.author || deployment.website || deployment.notes) ? (
                      <div className="mt-2 text-[10px] leading-relaxed text-violet-100/40">
                        {deployment.version ? <>Version <span className="font-semibold text-violet-100/55">{deployment.version}</span></> : null}
                        {deployment.version && deployment.author ? <span className="mx-1.5 text-white/15">•</span> : null}
                        {deployment.author ? <>By <span className="font-semibold text-violet-100/55">{deployment.author}</span></> : null}
                        {deployment.website ? <div className="mt-1 break-all">Source page: {deployment.website}</div> : null}
                        {deployment.notes ? <div className="mt-1 whitespace-pre-wrap text-white/30">{deployment.notes}</div> : null}
                      </div>
                    ) : null}
                    <NexusUpdateStatus
                      deployment={deployment}
                      update={nexusUpdateReport?.results?.find((result) => result.deploymentId === deployment.id)}
                      isPremium={nexusUpdateReport?.isPremium}
                      busy={busy}
                      action={nexusUpdateAction}
                      onSelect={prepareNexusUpdate}
                      onReview={reviewNexusUpdate}
                    />
                    {deployment.updatedUnix > deployment.deployedUnix ? (
                      <div className="mt-1 text-[10px] text-white/22">
                        Last upgraded {formatDate(deployment.updatedUnix)}
                      </div>
                    ) : null}
                    {!deployment.canToggle ? (
                      <div className="mt-2 text-[10px] text-amber-100/38">
                        Reinstall this legacy deployment once to add enable/disable support.
                      </div>
                    ) : deployment.enabled && !deployment.canRemove && !status?.purged ? (
                      <div className="mt-2 text-[10px] text-amber-100/38">
                        Disable this mod before permanently removing it from the library.
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {deployment.enabled ? (
                      <div className="flex overflow-hidden rounded-lg border border-white/10">
                        <button
                          type="button"
                          title="Move to higher priority"
                          aria-label={`Move ${deployment.name} to higher priority`}
                          onClick={() => movePriority(deployment, "higher")}
                          disabled={!deployment.canMoveHigher || busy}
                          className="inline-flex items-center gap-1 border-r border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] font-semibold text-white/50 hover:bg-white/[0.07] disabled:opacity-25"
                        >
                          {movingId === deployment.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ArrowUp className="h-3.5 w-3.5" />
                          )}
                          Higher
                        </button>
                        <button
                          type="button"
                          title="Move to lower priority"
                          aria-label={`Move ${deployment.name} to lower priority`}
                          onClick={() => movePriority(deployment, "lower")}
                          disabled={!deployment.canMoveLower || busy}
                          className="inline-flex items-center gap-1 bg-white/[0.03] px-2.5 py-2 text-[10px] font-semibold text-white/50 hover:bg-white/[0.07] disabled:opacity-25"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                          Lower
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => beginMetadataEdit(deployment)}
                      disabled={busy}
                      className="rounded-lg border border-violet-400/15 bg-violet-400/[0.04] px-3 py-2 text-xs font-semibold text-violet-100/60 hover:bg-violet-400/[0.09] disabled:opacity-30"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => beginUpgrade(deployment)}
                      disabled={!deployment.canToggle || busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.05] px-3 py-2 text-xs font-semibold text-cyan-100/65 hover:bg-cyan-400/[0.10] disabled:opacity-30"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Upgrade
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDeployment(deployment)}
                      disabled={!deployment.canToggle || busy}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-30 ${deployment.enabled ? "border-amber-400/20 bg-amber-400/[0.055] text-amber-100/65 hover:bg-amber-400/[0.10]" : "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100/70 hover:bg-emerald-400/[0.12]"}`}
                    >
                      {togglingId === deployment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Power className="h-3.5 w-3.5" />
                      )}
                      {deployment.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeDeployment(deployment)}
                      disabled={!deployment.canRemove || busy}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/[0.055] px-3 py-2 text-xs font-semibold text-red-100/65 hover:bg-red-400/[0.10] disabled:opacity-30"
                    >
                      {removingId === deployment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Uninstall
                    </button>
                  </div>
                </div>
                {editingMetadataId === deployment.id ? (
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <input
                      value={metadataDraft.name}
                      onChange={(event) => setMetadataDraft((current) => ({ ...current, name: event.target.value }))}
                      maxLength={120}
                      placeholder="Mod name"
                      className="mb-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65 outline-none focus:border-violet-400/30"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        value={metadataDraft.version}
                        onChange={(event) => setMetadataDraft((current) => ({ ...current, version: event.target.value }))}
                        maxLength={80}
                        placeholder="Version (for example 1.2.0)"
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65 outline-none focus:border-violet-400/30"
                      />
                      <input
                        value={metadataDraft.author}
                        onChange={(event) => setMetadataDraft((current) => ({ ...current, author: event.target.value }))}
                        maxLength={120}
                        placeholder="Author"
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65 outline-none focus:border-violet-400/30"
                      />
                    </div>
                    <input
                      value={metadataDraft.website}
                      onChange={(event) => setMetadataDraft((current) => ({ ...current, website: event.target.value }))}
                      maxLength={500}
                      placeholder="Source or mod page URL"
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65 outline-none focus:border-violet-400/30"
                    />
                    <textarea
                      value={metadataDraft.notes}
                      onChange={(event) => setMetadataDraft((current) => ({ ...current, notes: event.target.value }))}
                      maxLength={2000}
                      rows={3}
                      placeholder="Installation notes, requirements, or compatibility details"
                      className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65 outline-none focus:border-violet-400/30"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMetadataId(null)}
                        disabled={Boolean(savingMetadataId)}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-white/45 hover:bg-white/[0.07] disabled:opacity-30"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveMetadata(deployment)}
                        disabled={Boolean(savingMetadataId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-400/[0.07] px-3 py-2 text-[10px] font-semibold text-violet-100/70 hover:bg-violet-400/[0.12] disabled:opacity-30"
                      >
                        {savingMetadataId === deployment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Save metadata
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : activeView === "mods" ? (
          <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-5 text-center text-xs text-white/30">
            No mods are installed in the GameAtlas library for this game.
          </div>
        ) : null}
      </div>
      ) : null}


      {activeView === "conflicts" ? (
        <div
          id="linux-mod-view-conflicts"
          role="tabpanel"
          aria-label="Rules and conflicts"
          className="border-t border-white/[0.06] p-4"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-white/30">
                File Conflict Resolution
              </div>
              <div className="mt-1 text-[10px] text-white/25">
                Higher-priority enabled mods win shared destination paths.
              </div>
            </div>
            <div className="text-[10px] text-white/28">
              {status.totalConflictCount.toLocaleString()} conflicting file{status.totalConflictCount === 1 ? "" : "s"}
            </div>
          </div>

          {status?.deployments?.length > 0
          && status.totalConflictCount > 0 ? (
            <div className="mt-3 space-y-2">
              {status.conflicts.map((conflict) => (
                <div key={conflict.relativePath} className="rounded-lg border border-amber-400/12 bg-amber-400/[0.03] p-3">
                  <div className="break-all font-mono text-[10px] text-white/45">
                    {conflict.relativePath}
                  </div>
                  <div className="mt-1.5 text-[10px] text-white/30">
                    Winner: <span className="font-semibold text-emerald-100/65">{conflict.winnerName}</span>
                    {" • "}
                    Overrides: <span className="text-amber-100/55">{conflict.overriddenNames.join(", ")}</span>
                  </div>
                </div>
              ))}
              {status.totalConflictCount > status.conflicts.length ? (
                <div className="text-[10px] text-white/25">
                  Showing the first {status.conflicts.length.toLocaleString()} conflicting files.
                </div>
              ) : null}
            </div>
          ) : status?.deployments?.length > 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center text-xs text-white/28">
              Enabled mods do not currently overwrite the same files.
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-white/[0.08] px-3 py-4 text-center text-xs text-white/28">
              Install and enable mods to inspect file conflicts.
            </div>
          )}
        </div>
      ) : null}


      <div className="border-t border-white/[0.06] px-4 py-3 text-[10px] leading-relaxed text-white/22">
        ZIP, RAR, and 7z extraction is local and rejects unsafe paths, links, special files, password protection, excessive size, and case-only duplicates. RAR and 7z support use the detected system lsar/unar tools. GameAtlas can download eligible Nexus archives but does not resolve mod-specific installation rules, run installers, or guarantee compatibility. Confirm that the preview has the layout expected at the game root.
      </div>
    </div>
  );
}
