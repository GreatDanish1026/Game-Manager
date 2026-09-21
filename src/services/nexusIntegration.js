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
  file
) {
  return invoke(
    "download_nexus_file",
    {
      request: {
        gameName:
          game?.name
          ?? "Unknown Game",
        gameDomain: metadata.gameDomain,
        modId: metadata.modId,
        fileId: file.fileId,
        fileName:
          file.fileName
          || `${metadata.name || "Nexus Mod"}-${file.fileId}.zip`,
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
