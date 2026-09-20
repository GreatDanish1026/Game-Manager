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
  name
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
