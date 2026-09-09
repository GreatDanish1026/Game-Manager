const SERVICE_STATUS_KEY =
  "game-manager-service-status-v1";

export const SERVICE_IDS = {
  pcgw:
    "pcgw",

  renodx:
    "renodx",

  luma:
    "luma",

  vortex:
    "vortex",

  github:
    "github",
};


export const SERVICE_LABELS = {
  pcgw:
    "PCGamingWiki",

  renodx:
    "RenoDX",

  luma:
    "Luma Framework",

  vortex:
    "Vortex",

  github:
    "GitHub Updates",
};


function defaultRecord(
  serviceId
) {
  return {
    serviceId,

    status:
      "unknown",

    message:
      "Not checked yet.",

    checkedAt:
      null,
  };
}


function loadAll() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          SERVICE_STATUS_KEY
        ) ?? "{}"
      );

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
        ? parsed
        : {};
  } catch {
    return {};
  }
}


function saveAll(
  records
) {
  localStorage.setItem(
    SERVICE_STATUS_KEY,
    JSON.stringify(
      records
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-service-status-changed"
    )
  );
}


export function getServiceStatuses() {
  const stored =
    loadAll();

  return Object.fromEntries(
    Object.values(
      SERVICE_IDS
    ).map(
      (serviceId) => [
        serviceId,
        {
          ...defaultRecord(
            serviceId
          ),
          ...stored[
            serviceId
          ],
        },
      ]
    )
  );
}


export function setServiceStatus(
  serviceId,
  status,
  message = null
) {
  const records =
    loadAll();

  records[
    serviceId
  ] = {
    serviceId,

    status,

    message:
      message
      ?? (
        status === "online"
          ? "Service available."
          : status === "degraded"
            ? "Service responded with an issue."
            : status === "offline"
              ? "Service unavailable."
              : "Not checked yet."
      ),

    checkedAt:
      Date.now(),
  };

  saveAll(
    records
  );

  return records[
    serviceId
  ];
}


export function markServiceChecking(
  serviceId
) {
  const records =
    loadAll();

  records[
    serviceId
  ] = {
    ...defaultRecord(
      serviceId
    ),
    ...records[
      serviceId
    ],

    serviceId,

    status:
      "checking",

    message:
      "Checking service...",

    checkedAt:
      records[
        serviceId
      ]?.checkedAt
      ?? null,
  };

  saveAll(
    records
  );
}


export function clearServiceStatuses() {
  localStorage.removeItem(
    SERVICE_STATUS_KEY
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-service-status-changed"
    )
  );
}
