const ANALYSIS_STATE_KEY =
  "game-manager-analysis-state-v1";

const LEGACY_TIMESTAMPS_KEY =
  "game-manager-analysis-timestamps-v1";

export const ANALYSIS_SCHEMA_VERSION =
  1;


function parseStored(
  key,
  fallback
) {
  try {
    return JSON.parse(
      localStorage.getItem(
        key
      )
    ) ?? fallback;
  } catch {
    return fallback;
  }
}


function saveRecords(
  records
) {
  localStorage.setItem(
    ANALYSIS_STATE_KEY,
    JSON.stringify(
      records
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-analysis-state-changed"
    )
  );
}


function legacyMigration() {
  const existing =
    parseStored(
      ANALYSIS_STATE_KEY,
      {}
    );

  const timestamps =
    parseStored(
      LEGACY_TIMESTAMPS_KEY,
      {}
    );

  let changed =
    false;

  for (
    const [
      gameId,
      value,
    ]
    of Object.entries(
      timestamps
    )
  ) {
    if (
      existing[
        gameId
      ]
    ) {
      continue;
    }

    const timestamp =
      Number(value);

    if (
      !Number.isFinite(
        timestamp
      )
    ) {
      continue;
    }

    /*
     * v1.1 background analysis only wrote the legacy timestamp after
     * PCGamingWiki, RenoDX/Luma, and Vortex all completed successfully.
     * That makes the old timestamp safe to migrate as a successful record.
     */
    existing[
      gameId
    ] = {
      gameId,
      schemaVersion:
        ANALYSIS_SCHEMA_VERSION,

      attemptedAt:
        timestamp,

      completedAt:
        timestamp,

      sources: {
        pcgw:
          "success",

        renodx:
          "success",

        vortex:
          "success",
      },
    };

    changed =
      true;
  }

  if (changed) {
    saveRecords(
      existing
    );
  }

  return existing;
}


export function getAnalysisRecords() {
  return legacyMigration();
}


export function getAnalysisRecord(
  game
) {
  if (!game?.id) {
    return null;
  }

  return getAnalysisRecords()[
    game.id
  ] ?? null;
}


function sourceState(
  loaded,
  error
) {
  if (error) {
    return "error";
  }

  if (loaded) {
    return "success";
  }

  return "pending";
}


export function recordGameAnalysis(
  game
) {
  if (!game?.id) {
    return null;
  }

  const records =
    getAnalysisRecords();

  const sources = {
    pcgw:
      sourceState(
        game.pcgwLoaded,
        game.pcgwError
      ),

    renodx:
      sourceState(
        game.renodxLoaded,
        game.renodxError
      ),

    vortex:
      sourceState(
        game.vortexLoaded,
        game.vortexError
      ),
  };

  const complete =
    Object.values(
      sources
    )
      .every(
        (state) =>
          state === "success"
      );

  const now =
    Date.now();

  const previous =
    records[
      game.id
    ];

  records[
    game.id
  ] = {
    gameId:
      game.id,

    name:
      game.name ?? null,

    store:
      game.store ?? null,

    schemaVersion:
      ANALYSIS_SCHEMA_VERSION,

    attemptedAt:
      now,

    completedAt:
      complete
        ? now
        : previous
            ?.completedAt
          ?? null,

    sources,
  };

  saveRecords(
    records
  );

  return records[
    game.id
  ];
}


export function getAnalysisState(
  game,
  freshDays = 7
) {
  const record =
    getAnalysisRecord(
      game
    );

  if (!record) {
    return {
      status:
        "never",

      label:
        "Never analyzed",

      record:
        null,
    };
  }

  if (
    record.schemaVersion !==
    ANALYSIS_SCHEMA_VERSION
  ) {
    return {
      status:
        "stale",

      label:
        "Out of date",

      record,
    };
  }

  const sourceValues =
    Object.values(
      record.sources
      ?? {}
    );

  const anyError =
    sourceValues.some(
      (state) =>
        state === "error"
    );

  const allSuccessful =
    sourceValues.length >= 3
    &&
    sourceValues.every(
      (state) =>
        state === "success"
    );

  if (anyError) {
    return {
      status:
        "partial",

      label:
        "Partially analyzed",

      record,
    };
  }

  if (!allSuccessful) {
    return {
      status:
        "partial",

      label:
        "Partially analyzed",

      record,
    };
  }

  const completedAt =
    Number(
      record.completedAt
      ?? 0
    );

  const freshMs =
    Math.max(
      1,
      Number(
        freshDays
      ) || 7
    )
    * 24
    * 60
    * 60
    * 1000;

  if (
    !Number.isFinite(
      completedAt
    )
    ||
    Date.now() -
      completedAt >=
      freshMs
  ) {
    return {
      status:
        "stale",

      label:
        "Out of date",

      record,
    };
  }

  return {
    status:
      "full",

    label:
      "Fully analyzed",

    record,
  };
}


export function getLibraryAnalysisSummary(
  games,
  freshDays = 7
) {
  const summary = {
    total:
      games?.length
      ?? 0,

    full:
      0,

    partial:
      0,

    stale:
      0,

    never:
      0,
  };

  for (
    const game
    of games ?? []
  ) {
    const {
      status,
    } =
      getAnalysisState(
        game,
        freshDays
      );

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          summary,
          status
        )
    ) {
      summary[
        status
      ] +=
        1;
    }
  }

  summary.coverage =
    summary.total > 0
      ? Math.round(
          (
            summary.full /
            summary.total
          ) * 100
        )
      : 0;

  summary.remaining =
    summary.total -
    summary.full;

  return summary;
}


export function clearAnalysisState() {
  localStorage.removeItem(
    ANALYSIS_STATE_KEY
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-analysis-state-changed"
    )
  );
}
