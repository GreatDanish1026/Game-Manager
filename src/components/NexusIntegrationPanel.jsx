import {
  AlertTriangle,
  Crown,
  Download,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  openUrl,
} from "@tauri-apps/plugin-opener";
import {
  listen,
} from "@tauri-apps/api/event";

import {
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
      let active = true;
      let stopListening = null;

      async function refreshPendingLink() {
        let nxmUrl = null;
        try {
          const links = await getPendingNxmLinks();
          nxmUrl = links?.[0];
          if (!active || !nxmUrl) {
            return;
          }
          const info = await inspectNxmLink(nxmUrl);
          if (active) {
            setPendingNxm(
              (current) => current?.nxmUrl === nxmUrl
                ? current
                : {
                    nxmUrl,
                    info,
                  }
            );
          }
        } catch (linkError) {
          if (nxmUrl) {
            await dismissNxmLink(nxmUrl).catch(() => {});
          }
          if (active) {
            setError(`${String(linkError)} The invalid or expired link was discarded.`);
          }
        }
      }

      listen(
        "gameatlas:nxm-link",
        refreshPendingLink
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
      refreshPendingLink();

      return () => {
        active = false;
        stopListening?.();
      };
    },
    []
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
            setNexusUrl(next.modPageUrl);
            const nextAccount = await getNexusAccountStatus();
            if (active) {
              setAccount(nextAccount);
              onAccountStatusChange?.(nextAccount);
            }
            if (!next.files.some((file) => file.fileId === pendingNxm.info.fileId)) {
              setError(
                `Nexus file ${pendingNxm.info.fileId} is no longer present in this mod's file catalog.`
              );
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
    } catch (openError) {
      setError(String(openError));
    }
  }


  async function downloadFile(
    file
  ) {
    setAction(`download-${file.fileId}`);
    setError(null);
    setNotice(null);
    try {
      const usesPendingNxm = pendingNxm?.info.fileId === file.fileId
        && pendingNxm?.info.modId === metadata.modId
        && pendingNxm?.info.gameDomain === metadata.gameDomain;
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
      }
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
      setError(String(downloadError));
      await syncAccountFromSession();
    } finally {
      setAction(null);
    }
  }


  async function dismissPendingNxm() {
    if (!pendingNxm) {
      return;
    }
    try {
      await dismissNxmLink(pendingNxm.nxmUrl);
      setPendingNxm(null);
    } catch (dismissError) {
      setError(String(dismissError));
    }
  }


  async function openFilePage(
    file
  ) {
    await openExternal(
      `${metadata.modPageUrl}?tab=files&file_id=${file.fileId}`
    );
    if (!account?.isPremium) {
      setNotice(
        "After the browser download finishes, move the ZIP, RAR, or 7z archive into this game's VortexMods folder and select Refresh."
      );
    }
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
  const pendingNxmCanDownload = Boolean(
    pendingNxmFile
    && /\.(zip|rar|7z)$/i.test(pendingNxmFile.fileName ?? "")
    && (
      account?.isPremium
      || pendingNxm?.info.authenticated
    )
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
              <div className="text-xs font-semibold text-white/65">
                Nexus Mods account, catalog & downloads
              </div>
              <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-100/55">
                Testing integration
              </span>
            </div>
            <div className="mt-1 max-w-3xl text-[11px] leading-relaxed text-white/32">
              Connect with a personal API key during testing, paste a Nexus mod-page URL, or use Mod Manager Download to send supported archives into this game's local staging folder.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openExternal(NEXUS_API_SETTINGS)}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-white/45 hover:bg-white/[0.06]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Nexus API settings
        </button>
      </div>

      <details className="mt-3 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-200/55" />
          Privacy & security
        </summary>
        <div className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-white/32">
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

      {error ? (
        <div className="mt-3 rounded-lg border border-red-400/10 bg-red-400/[0.04] px-3 py-2 text-[11px] leading-relaxed text-red-100/65">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-3 rounded-lg border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2 text-[11px] leading-relaxed text-emerald-100/65">
          {notice}
        </div>
      ) : null}

      {pendingNxm ? (
        <div className="mt-3 rounded-lg border border-violet-300/15 bg-violet-300/[0.055] px-3 py-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-violet-100/70">
                Nexus Mod Manager download received
              </div>
              <div className="mt-1 text-[10px] leading-relaxed text-white/38">
                Nexus requested {pendingNxm.info.gameDomain} mod {pendingNxm.info.modId}, file {pendingNxm.info.fileId}. It will be downloaded into the VortexMods staging folder for {game?.name || "the selected game"}; confirm this is the intended game before downloading.
              </div>
              {!account?.connected ? (
                <div className="mt-1 text-[10px] text-amber-100/55">
                  Connect the same Nexus account used to create the link to continue.
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {action === "nxm-lookup" ? (
                <div className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-semibold text-violet-100/50">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading selected file…
                </div>
              ) : pendingNxmCanDownload ? (
                <button
                  type="button"
                  onClick={() => downloadFile(pendingNxmFile)}
                  disabled={busy || !game?.name || quotaExhausted}
                  title={quotaExhausted ? "Refresh the Nexus account after its quota resets." : undefined}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1.5 text-[9px] font-semibold text-emerald-100/65 hover:bg-emerald-300/[0.10] disabled:opacity-35"
                >
                  {action === `download-${pendingNxmFile.fileId}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Download Nexus selection
                </button>
              ) : null}
              <button
                type="button"
                onClick={dismissPendingNxm}
                disabled={busy}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-[9px] font-semibold text-white/40 hover:bg-white/[0.05] disabled:opacity-35"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!account ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/30">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading Nexus account status…
        </div>
      ) : connected ? (
        <div className="mt-3">
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${account.hourlyRemaining === 0 || account.dailyRemaining === 0 ? "border-red-400/15 bg-red-400/[0.04]" : (account.hourlyRemaining ?? Infinity) <= 10 || (account.dailyRemaining ?? Infinity) <= 10 ? "border-amber-400/15 bg-amber-400/[0.04]" : "border-emerald-400/10 bg-emerald-400/[0.035]"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <UserRound className="h-4 w-4 text-emerald-200/55" />
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-white/65">
                  {account.name ?? "Connected Nexus user"}
                  {account.isPremium ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wide text-amber-100/60">
                      <Crown className="h-2.5 w-2.5" />
                      Premium
                    </span>
                  ) : account.isSupporter ? (
                    <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wide text-violet-100/60">
                      Supporter
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] uppercase tracking-wide text-white/35">
                      Free
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[10px] text-white/28">
                  API quota: {account.hourlyRemaining ?? "—"} hourly · {account.dailyRemaining ?? "—"} daily remaining · session only
                </div>
                {account.hourlyRemaining === 0 || account.dailyRemaining === 0 ? (
                  <div className="mt-1 flex items-start gap-1.5 text-[10px] text-red-100/60">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      Nexus requests are paused until quota resets{formatReset(account.dailyRemaining === 0 ? account.dailyReset : account.hourlyReset) ? ` at ${formatReset(account.dailyRemaining === 0 ? account.dailyReset : account.hourlyReset)}` : ""}. Select Refresh after the reset to resume.
                    </span>
                  </div>
                ) : (account.hourlyRemaining ?? Infinity) <= 10 || (account.dailyRemaining ?? Infinity) <= 10 ? (
                  <div className="mt-1 flex items-start gap-1.5 text-[10px] text-amber-100/55">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      Nexus quota is low. Automatic update checks are paused to preserve the remaining requests.
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/40 hover:bg-white/[0.05] disabled:opacity-35"
              >
                <RefreshCw className={`h-3 w-3 ${action === "refresh" ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/40 hover:bg-white/[0.05] disabled:opacity-35"
              >
                <LogOut className="h-3 w-3" />
                Disconnect
              </button>
            </div>
          </div>

          <form
            onSubmit={lookup}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="url"
              value={nexusUrl}
              onChange={(event) => setNexusUrl(event.target.value)}
              placeholder="https://www.nexusmods.com/game/mods/123"
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65 outline-none placeholder:text-white/20 focus:border-violet-300/25 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={busy || !nexusUrl.trim() || quotaExhausted}
              title={quotaExhausted ? "Refresh the Nexus account after its quota resets." : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-xs font-semibold text-violet-100/70 hover:bg-violet-300/[0.11] disabled:opacity-35"
            >
              {action === "lookup" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Look up metadata
            </button>
          </form>
        </div>
      ) : (
        <form
          onSubmit={connect}
          className="mt-3 flex flex-col gap-2 sm:flex-row"
        >
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste a personal Nexus Mods API key"
            autoComplete="off"
            spellCheck="false"
            disabled={busy}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/65 outline-none placeholder:text-white/20 focus:border-violet-300/25 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={busy || !apiKey.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-xs font-semibold text-violet-100/70 hover:bg-violet-300/[0.11] disabled:opacity-35"
          >
            {action === "connect" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="h-3.5 w-3.5" />
            )}
            Connect account
          </button>
        </form>
      )}

      {metadata ? (
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
                <div className="mt-1 text-[10px] text-white/28">
                  By {metadata.author || "Unknown author"} · Updated {formatDate(metadata.updatedUnix)} · {metadata.endorsementCount ?? 0} endorsements
                </div>
                {metadata.summary ? (
                  <div className="mt-2 max-w-4xl text-[11px] leading-relaxed text-white/38">
                    {metadata.summary}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => openExternal(metadata.modPageUrl)}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/40 hover:bg-white/[0.05]"
              >
                <ExternalLink className="h-3 w-3" />
                Open mod page
              </button>
            </div>
          </div>

          <div className="p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-white/28">
              File catalog ({metadata.files.length})
            </div>
            {metadata.files.length > 0 ? (
              <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {metadata.files.map((file) => {
                  const requestedByNxm = pendingNxm?.info.fileId === file.fileId
                    && pendingNxm?.info.modId === metadata.modId
                    && pendingNxm?.info.gameDomain === metadata.gameDomain;
                  const canDownload = account?.isPremium
                    || (requestedByNxm && pendingNxm?.info.authenticated);
                  return (
                  <div
                    key={file.fileId}
                    className={`flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${requestedByNxm ? "border-violet-300/20 bg-violet-300/[0.045]" : "border-white/[0.06] bg-white/[0.018]"}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-semibold text-white/50">
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
                      <div className="mt-0.5 truncate text-[9px] text-white/24">
                        {file.fileName || "Unknown filename"}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                      <div className="text-[9px] text-white/28">
                        {file.categoryName || "Uncategorized"} · {file.version ? `v${file.version} · ` : ""}{formatBytes(file.sizeBytes)} · {formatDate(file.uploadedUnix)}
                      </div>
                      {canDownload && /\.(zip|rar|7z)$/i.test(file.fileName ?? "") ? (
                        <button
                          type="button"
                          onClick={() => downloadFile(file)}
                          disabled={busy || !game?.name || quotaExhausted}
                          title={quotaExhausted ? "Refresh the Nexus account after its quota resets." : undefined}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/15 bg-emerald-300/[0.06] px-2.5 py-1.5 text-[9px] font-semibold text-emerald-100/60 hover:bg-emerald-300/[0.10] disabled:opacity-35"
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
                          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[9px] font-semibold text-white/40 hover:bg-white/[0.05] disabled:opacity-35"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {account?.isPremium ? "Open unsupported file" : "Browser download"}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-white/28">
                Nexus returned no files for this mod.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
