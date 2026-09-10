import {
  getChangeHistory,
} from "./changeHistory";


const MOD_CHANGE_LABELS = {
  reshadeInstalled: {
    name: "ReShade",
    kind: "presence",
  },

  reshadePreset: {
    name: "ReShade preset",
    kind: "value",
  },

  specialKDetected: {
    name: "Special K",
    kind: "presence",
  },

  vortexEvidence: {
    name: "Vortex evidence",
    kind: "presence",
  },

  fluffyEvidence: {
    name: "Fluffy Mod Manager evidence",
    kind: "presence",
  },
};


function asBoolean(
  value
) {
  if (
    value === true
    || value === false
  ) {
    return value;
  }

  if (
    value === "true"
    || value === 1
    || value === "1"
  ) {
    return true;
  }

  if (
    value === "false"
    || value === 0
    || value === "0"
    || value === null
    || value === undefined
  ) {
    return false;
  }

  return Boolean(
    value
  );
}


function describePresenceChange(
  definition,
  change
) {
  const before =
    asBoolean(
      change.before
    );

  const after =
    asBoolean(
      change.after
    );

  if (
    before === after
  ) {
    return null;
  }

  return {
    action:
      after
        ? "detected"
        : "removed",

    title:
      after
        ? `${definition.name} detected`
        : `${definition.name} removed`,

    description:
      after
        ? `${definition.name} appeared in the local game installation.`
        : `${definition.name} is no longer detected in the local game installation.`,
  };
}


function describeValueChange(
  definition,
  change
) {
  const before =
    change.before
      ?? null;

  const after =
    change.after
      ?? null;

  if (
    before === after
  ) {
    return null;
  }

  if (
    !before
    && after
  ) {
    return {
      action:
        "detected",

      title:
        `${definition.name} detected`,

      description:
        String(
          after
        ),
    };
  }

  if (
    before
    && !after
  ) {
    return {
      action:
        "removed",

      title:
        `${definition.name} removed`,

      description:
        String(
          before
        ),
    };
  }

  return {
    action:
      "changed",

    title:
      `${definition.name} changed`,

    description:
      `${String(
        before
      )} → ${String(
        after
      )}`,
  };
}


function translateChange(
  change
) {
  if (
    !change
    || change.category
      !== "Mods"
  ) {
    return null;
  }

  const definition =
    MOD_CHANGE_LABELS[
      change.key
    ];

  if (!definition) {
    return {
      action:
        "changed",

      title:
        `${change.label ?? "Mod state"} changed`,

      description:
        `${String(
          change.before
          ?? "Not detected"
        )} → ${String(
          change.after
          ?? "Not detected"
        )}`,
    };
  }

  const translated =
    definition.kind
      === "presence"
        ? describePresenceChange(
            definition,
            change
          )
        : describeValueChange(
            definition,
            change
          );

  if (!translated) {
    return null;
  }

  return {
    ...translated,

    key:
      change.key,

    raw:
      change,
  };
}


export function getModChangeTimeline(
  game
) {
  const history =
    getChangeHistory(
      game
    );

  const timeline = [];

  for (
    const event
    of history.events
      ?? []
  ) {
    const modChanges =
      (
        event.changes
        ?? []
      )
        .map(
          translateChange
        )
        .filter(
          Boolean
        );

    for (
      const change
      of modChanges
    ) {
      timeline.push({
        id:
          `${event.id}:${change.key ?? change.title}`,

        detectedAt:
          event.detectedAt,

        ...change,
      });
    }
  }

  return timeline
    .sort(
      (
        left,
        right
      ) =>
        new Date(
          right.detectedAt
          ?? 0
        ).getTime()
        - new Date(
            left.detectedAt
            ?? 0
          ).getTime()
    );
}


export function getModChangeTimelineSummary(
  game
) {
  const timeline =
    getModChangeTimeline(
      game
    );

  const latest =
    timeline[0]
    ?? null;

  return {
    count:
      timeline.length,

    latest,
  };
}
