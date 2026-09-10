import {
  invoke,
} from "@tauri-apps/api/core";

import {
  getSettings,
} from "./settings";


function commonArgs(
  game
) {
  return {
    gameName:
      game.name,

    gameId:
      game.id
      ?? null,

    savePath:
      game.technical
        ?.saveLocation,

    installPath:
      game.installPath
      ?? null,

    protonPrefix:
      game?.protonPrefix
      ?? null,
  };
}


const PER_GAME_BACKUP_SETTINGS_KEY =
  "game-manager-backup-options-v1";


function gameSettingsKey(
  game
) {
  return String(
    game?.id
    ?? game?.name
    ?? ""
  );
}


function loadPerGameBackupSettings() {
  try {
    const raw =
      localStorage.getItem(
        PER_GAME_BACKUP_SETTINGS_KEY
      );

    const parsed =
      raw
        ? JSON.parse(raw)
        : {};

    return parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
        ? parsed
        : {};
  } catch {
    return {};
  }
}


function savePerGameBackupSettings(
  value
) {
  localStorage.setItem(
    PER_GAME_BACKUP_SETTINGS_KEY,
    JSON.stringify(
      value
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-backup-options-changed"
    )
  );
}


function getPerGameBackupOptions(
  game
) {
  const key =
    gameSettingsKey(
      game
    );

  if (!key) {
    return {};
  }

  return loadPerGameBackupSettings()[
    key
  ] ?? {};
}


function updatePerGameBackupOptions(
  game,
  patch
) {
  const key =
    gameSettingsKey(
      game
    );

  if (!key) {
    throw new Error(
      "Cannot save backup options for an unidentified game."
    );
  }

  const current =
    loadPerGameBackupSettings();

  const previous =
    current[key]
    ?? {};

  current[key] = {
    ...previous,
    ...patch,

    updatedAt:
      new Date()
        .toISOString(),
  };

  savePerGameBackupSettings(
    current
  );

  return current[key];
}


export function getGameBackupRetentionCount(
  game
) {
  const stored =
    getPerGameBackupOptions(
      game
    )
      ?.retentionCount;

  if (
    Number.isInteger(stored)
    && stored >= 0
  ) {
    return stored;
  }

  return getSettings()
    .backupRetentionCount
    ?? 0;
}


export function setGameBackupRetentionCount(
  game,
  retentionCount
) {
  const key =
    gameSettingsKey(
      game
    );

  if (!key) {
    throw new Error(
      "Cannot save backup retention for an unidentified game."
    );
  }

  const allowed =
    new Set([
      0,
      5,
      10,
      20,
      50,
    ]);

  const normalized =
    Number(
      retentionCount
    );

  if (!allowed.has(normalized)) {
    throw new Error(
      "Unsupported backup retention value."
    );
  }

  updatePerGameBackupOptions(
    game,
    {
      retentionCount:
        normalized,
    }
  );

  return normalized;
}


export function getGamePreLaunchBackupEnabled(
  game
) {
  const stored =
    getPerGameBackupOptions(
      game
    )
      ?.preLaunchBackupEnabled;

  if (
    typeof stored
    === "boolean"
  ) {
    return stored;
  }

  return Boolean(
    getSettings()
      .backupBeforeLaunch
  );
}


export function setGamePreLaunchBackupEnabled(
  game,
  enabled
) {
  updatePerGameBackupOptions(
    game,
    {
      preLaunchBackupEnabled:
        Boolean(
          enabled
        ),
    }
  );

  return Boolean(
    enabled
  );
}


export function getBackupNotes(
  game
) {
  const notes =
    getPerGameBackupOptions(
      game
    )
      ?.backupNotes;

  return notes
    && typeof notes
      === "object"
    && !Array.isArray(
      notes
    )
      ? notes
      : {};
}


export function getBackupNote(
  game,
  backupFileName
) {
  return String(
    getBackupNotes(
      game
    )[
      backupFileName
    ]
    ?? ""
  );
}


export function setBackupNote(
  game,
  backupFileName,
  note
) {
  const fileName =
    String(
      backupFileName
      ?? ""
    )
      .trim();

  if (!fileName) {
    throw new Error(
      "Cannot save a note without a backup file name."
    );
  }

  const normalizedNote =
    String(
      note
      ?? ""
    )
      .trim();

  const notes = {
    ...getBackupNotes(
      game
    ),
  };

  if (normalizedNote) {
    notes[fileName] =
      normalizedNote;
  } else {
    delete notes[
      fileName
    ];
  }

  updatePerGameBackupOptions(
    game,
    {
      backupNotes:
        notes,
    }
  );

  return normalizedNote;
}


export function removeBackupNote(
  game,
  backupFileName
) {
  return setBackupNote(
    game,
    backupFileName,
    ""
  );
}


function retentionCount(
  game
) {
  return getGameBackupRetentionCount(
    game
  );
}


export async function getSaveBackupStatus(
  game
) {
  return invoke(
    "get_save_backup_status",
    commonArgs(
      game
    )
  );
}


export async function getBackupStorageSummary() {
  return invoke(
    "get_backup_storage_summary"
  );
}


export async function createSaveBackup(
  game,
  {
    backupType =
      "manual",
  } = {}
) {
  return invoke(
    "create_save_backup",
    {
      ...commonArgs(
        game
      ),

      retentionCount:
        retentionCount(
          game
        ),

      backupType:
        backupType ===
          "pre_launch"
          ? "pre_launch"
          : "backup",
    }
  );
}


export async function deleteSaveBackup(
  game,
  backupFileName
) {
  return invoke(
    "delete_save_backup",
    {
      ...commonArgs(
        game
      ),

      backupFileName,
    }
  );
}


export async function restoreSaveBackup(
  game,
  backupFileName
) {
  return invoke(
    "restore_save_backup",
    {
      ...commonArgs(
        game
      ),

      backupFileName,

      // Restore safety backups are intentionally excluded from
      // automatic retention pruning.
      retentionCount:
        0,
    }
  );
}
