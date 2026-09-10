const STORAGE_KEY =
  "game-manager-personal-ratings-v1";

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function saveAll(ratings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
  window.dispatchEvent(
    new CustomEvent("game-manager-personal-ratings-changed")
  );
}

export function getPersonalRating(gameOrId) {
  const id =
    typeof gameOrId === "string"
      ? gameOrId
      : gameOrId?.id;

  if (!id) return null;

  const value = Number(loadAll()[id]);

  return Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
      ? value
      : null;
}

export function setPersonalRating(gameOrId, rating) {
  const id =
    typeof gameOrId === "string"
      ? gameOrId
      : gameOrId?.id;

  const value = Number(rating);

  if (
    !id ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 5
  ) {
    throw new Error(
      "Personal rating must be an integer from 1 to 5."
    );
  }

  const ratings = loadAll();
  ratings[id] = value;
  saveAll(ratings);
  return value;
}

export function clearPersonalRating(gameOrId) {
  const id =
    typeof gameOrId === "string"
      ? gameOrId
      : gameOrId?.id;

  if (!id) return;

  const ratings = loadAll();
  delete ratings[id];
  saveAll(ratings);
}

export function getPersonalRatingStats(games = []) {
  const ratings = games
    .map((game) => getPersonalRating(game))
    .filter((rating) => rating !== null);

  const distribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const rating of ratings) {
    distribution[rating] += 1;
  }

  return {
    ratedCount: ratings.length,
    average: ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
      : null,
    distribution,
  };
}
