const STORAGE_KEY = "game-manager-hidden-games";

export function getHiddenGameIds() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch (error) {
    console.error(
      "[Hidden Games] Failed to load hidden games:",
      error
    );

    return [];
  }
}


export function saveHiddenGameIds(
  gameIds
) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(gameIds)
    );
  } catch (error) {
    console.error(
      "[Hidden Games] Failed to save hidden games:",
      error
    );
  }
}