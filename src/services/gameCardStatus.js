import {
  getPlayStatusNotes,
  playStatusLabel,
} from "./playStatusNotes";

import {
  getLaunchHistory,
} from "./recentActivity";

import {
  getLaunchProfileState,
} from "./launchProfiles";

import {
  getChangeHistory,
} from "./changeHistory";


const STATUS_STYLE = {
  playing: {
    label: "Playing",
    tone: "cyan",
  },

  completed: {
    label: "Completed",
    tone: "emerald",
  },

  on_hold: {
    label: "On Hold",
    tone: "amber",
  },

  dropped: {
    label: "Dropped",
    tone: "rose",
  },

  replay: {
    label: "Replay",
    tone: "violet",
  },
};


function validDate(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


export function formatCardDate(
  value
) {
  const date =
    validDate(
      value
    );

  if (!date) {
    return null;
  }

  const diffMs =
    Date.now()
    - date.getTime();

  if (diffMs < 0) {
    return date.toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
      }
    );
  }

  const minute =
    60 * 1000;

  const hour =
    60 * minute;

  const day =
    24 * hour;

  if (diffMs < minute) {
    return "Just now";
  }

  if (diffMs < hour) {
    return `${Math.max(
      1,
      Math.floor(
        diffMs / minute
      )
    )}m ago`;
  }

  if (diffMs < day) {
    return `${Math.max(
      1,
      Math.floor(
        diffMs / hour
      )
    )}h ago`;
  }

  if (diffMs < 7 * day) {
    return `${Math.max(
      1,
      Math.floor(
        diffMs / day
      )
    )}d ago`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    }
  );
}


function getStatusInfo(
  game
) {
  const entry =
    getPlayStatusNotes(
      game
    );

  const configured =
    STATUS_STYLE[
      entry.status
    ];

  if (!configured) {
    return null;
  }

  return {
    ...configured,

    id:
      entry.status,

    label:
      playStatusLabel(
        entry.status
      ),
  };
}


function getLastLaunch(
  game
) {
  const history =
    getLaunchHistory(
      game
    );

  const entry =
    history[0]
    ?? null;

  if (!entry) {
    return null;
  }

  return {
    launchedAt:
      entry.launchedAt,

    relative:
      formatCardDate(
        entry.launchedAt
      ),

    profileName:
      entry.profileName
      ?? "Normal",
  };
}


function getDefaultProfile(
  game
) {
  const state =
    getLaunchProfileState(
      game
    );

  const profile =
    state.profiles
      ?.find(
        (item) =>
          item.id
          === state.defaultProfileId
      )
    ?? state.profiles?.[0]
    ?? null;

  if (!profile) {
    return null;
  }

  const isNormal =
    profile.id === "normal"
    && String(
      profile.name
      ?? ""
    )
      .trim()
      .toLowerCase()
      === "normal";

  return {
    id:
      profile.id,

    name:
      String(
        profile.name
        ?? "Normal"
      ),

    launchMode:
      profile.launchMode
      ?? "launcher",

    isNormal,
  };
}


function getLatestChanges(
  game
) {
  const history =
    getChangeHistory(
      game
    );

  const event =
    history.events?.[0]
    ?? null;

  if (
    !event
    || !Array.isArray(
      event.changes
    )
    || event.changes.length === 0
  ) {
    return null;
  }

  return {
    count:
      event.changes.length,

    detectedAt:
      event.detectedAt
      ?? null,

    relative:
      formatCardDate(
        event.detectedAt
      ),
  };
}


export function getGameCardStatus(
  game
) {
  if (!game) {
    return {
      playStatus:
        null,

      lastLaunch:
        null,

      defaultProfile:
        null,

      latestChanges:
        null,
    };
  }

  return {
    playStatus:
      getStatusInfo(
        game
      ),

    lastLaunch:
      getLastLaunch(
        game
      ),

    defaultProfile:
      getDefaultProfile(
        game
      ),

    latestChanges:
      getLatestChanges(
        game
      ),
  };
}


export const GAME_CARD_STATUS_EVENTS = [
  "game-manager-play-status-notes-changed",
  "game-manager-launch-history-changed",
  "game-manager-launch-profiles-changed",
  "game-manager-change-history-changed",
];
