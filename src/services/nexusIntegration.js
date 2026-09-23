import {
  invoke,
} from "@tauri-apps/api/core";


export function getNexusAccountStatus() {
  return invoke(
    "get_nexus_account_status"
  );
}


export function connectNexusAccount(
  apiKey
) {
  return invoke(
    "connect_nexus_account",
    {
      request: {
        apiKey,
      },
    }
  );
}


export function refreshNexusAccount() {
  return invoke(
    "refresh_nexus_account"
  );
}


export function disconnectNexusAccount() {
  return invoke(
    "disconnect_nexus_account"
  );
}


export function lookupNexusMod(
  nexusUrl
) {
  return invoke(
    "lookup_nexus_mod",
    {
      request: {
        nexusUrl,
      },
    }
  );
}


export function downloadNexusFile(
  game,
  metadata,
  file,
  nxmUrl = null
) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const downloadId = `nexus-${file.fileId}-${randomPart}`;
  return invoke(
    "download_nexus_file",
    {
      request: {
        downloadId,
        gameName:
          game?.name
          ?? "Unknown Game",
        gameDomain: metadata.gameDomain,
        modId: metadata.modId,
        fileId: file.fileId,
        fileName:
          file.fileName
          || `${metadata.name || "Nexus Mod"}-${file.fileId}.zip`,
        nxmUrl,
      },
    }
  ).catch(
    (error) => {
      window.dispatchEvent(
        new CustomEvent(
          "gameatlas:nexus-download-stage",
          {
            detail: {
              downloadId,
              phase: String(error).toLowerCase().includes("download canceled")
                ? "canceled"
                : "failed",
            },
          }
        )
      );
      throw error;
    }
  );
}


export function cancelNexusDownload(
  downloadId
) {
  return invoke(
    "cancel_nexus_download",
    {
      request: {
        downloadId,
      },
    }
  );
}


export function inspectNxmLink(
  nxmUrl
) {
  return invoke(
    "inspect_nxm_link",
    {
      request: {
        nxmUrl,
      },
    }
  );
}


export function getPendingNxmLinks() {
  return invoke(
    "get_pending_nxm_links"
  );
}


export function dismissNxmLink(
  nxmUrl
) {
  return invoke(
    "dismiss_nxm_link",
    {
      request: {
        nxmUrl,
      },
    }
  );
}


export function checkNexusModUpdates(
  deployments
) {
  return invoke(
    "check_nexus_mod_updates",
    {
      request: {
        mods: deployments
          .filter(
            (deployment) => deployment.nexusGameDomain
              && deployment.nexusModId
              && deployment.nexusFileId
          )
          .map(
            (deployment) => ({
              deploymentId: deployment.id,
              name: deployment.name,
              gameDomain: deployment.nexusGameDomain,
              modId: deployment.nexusModId,
              fileId: deployment.nexusFileId,
            })
          ),
      },
    }
  );
}
