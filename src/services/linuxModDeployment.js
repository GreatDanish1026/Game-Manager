import {
  invoke,
} from "@tauri-apps/api/core";


export async function getLinuxModDeploymentStatus(
  game
) {
  return invoke(
    "get_linux_mod_deployment_status",
    {
      installPath:
        game?.installPath
        ?? "",

      gameName:
        game?.name
        ?? "Unknown Game",
    }
  );
}


export async function pickLinuxModSource(
  game
) {
  return invoke(
    "pick_linux_mod_source",
    {
      installPath:
        game?.installPath
        ?? "",

      gameName:
        game?.name
        ?? "Unknown Game",
    }
  );
}


export async function prepareLinuxStagedMod(
  game,
  itemPath
) {
  return invoke(
    "prepare_linux_staged_mod",
    {
      installPath:
        game?.installPath
        ?? "",
      gameName:
        game?.name
        ?? "Unknown Game",
      itemPath,
    }
  );
}


export async function deployLinuxMod(
  game,
  sourcePath,
  name,
  metadata = null
) {
  return invoke(
    "deploy_linux_mod",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        sourcePath,
        name,
        version: metadata?.version ?? "",
        author: metadata?.author ?? "",
        website: metadata?.website ?? "",
        notes: metadata?.notes ?? "",
        nexusGameDomain: metadata?.nexusGameDomain ?? "",
        nexusModId: metadata?.nexusModId ?? null,
        nexusFileId: metadata?.nexusFileId ?? null,
      },
    }
  );
}


export async function removeLinuxModDeployment(
  game,
  deploymentId
) {
  return invoke(
    "remove_linux_mod_deployment",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        deploymentId,
      },
    }
  );
}


export async function setLinuxModEnabled(
  game,
  deploymentId,
  enabled
) {
  return invoke(
    "set_linux_mod_enabled",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        deploymentId,
        enabled,
      },
    }
  );
}


export async function moveLinuxModPriority(
  game,
  deploymentId,
  direction
) {
  return invoke(
    "move_linux_mod_priority",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        deploymentId,
        direction,
      },
    }
  );
}


export async function updateLinuxModMetadata(
  game,
  deploymentId,
  metadata
) {
  return invoke(
    "update_linux_mod_metadata",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        deploymentId,
        name: metadata?.name ?? "",
        version: metadata?.version ?? "",
        author: metadata?.author ?? "",
        website: metadata?.website ?? "",
        notes: metadata?.notes ?? "",
      },
    }
  );
}


export async function upgradeLinuxMod(
  game,
  deploymentId,
  sourcePath,
  metadata = null
) {
  return invoke(
    "upgrade_linux_mod",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        deploymentId,
        sourcePath,
        version: metadata?.version ?? "",
        author: metadata?.author ?? "",
        website: metadata?.website ?? "",
        notes: metadata?.notes ?? "",
        nexusGameDomain: metadata?.nexusGameDomain ?? "",
        nexusModId: metadata?.nexusModId ?? null,
        nexusFileId: metadata?.nexusFileId ?? null,
      },
    }
  );
}


export async function createLinuxModProfile(
  game,
  name
) {
  return invoke(
    "create_linux_mod_profile",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        profileId: null,
        name,
      },
    }
  );
}


export async function renameLinuxModProfile(
  game,
  profileId,
  name
) {
  return invoke(
    "rename_linux_mod_profile",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        profileId,
        name,
      },
    }
  );
}


export async function deleteLinuxModProfile(
  game,
  profileId
) {
  return invoke(
    "delete_linux_mod_profile",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        profileId,
      },
    }
  );
}


export async function activateLinuxModProfile(
  game,
  profileId
) {
  return invoke(
    "activate_linux_mod_profile",
    {
      request: {
        installPath:
          game?.installPath
          ?? "",
        profileId,
      },
    }
  );
}


export async function verifyLinuxModLibrary(
  game
) {
  return invoke(
    "verify_linux_mod_library",
    {
      installPath:
        game?.installPath
        ?? "",
    }
  );
}


export async function purgeLinuxModLibrary(
  game
) {
  return invoke(
    "purge_linux_mod_library",
    {
      installPath:
        game?.installPath
        ?? "",
    }
  );
}


export async function redeployLinuxModLibrary(
  game
) {
  return invoke(
    "redeploy_linux_mod_library",
    {
      installPath:
        game?.installPath
        ?? "",
    }
  );
}


export async function repairLinuxModLibrary(
  game
) {
  return invoke(
    "repair_linux_mod_library",
    {
      installPath:
        game?.installPath
        ?? "",
    }
  );
}
