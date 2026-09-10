const STORAGE_KEY = "game-manager-manual-games-v1";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(games) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
}

function newId() {
  if (globalThis.crypto?.randomUUID) {
    return `manual:${globalThis.crypto.randomUUID()}`;
  }
  return `manual:${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getManualGames() {
  return readAll();
}

export function addManualGame({ name, executablePath, installPath }) {
  const cleanName = String(name ?? "").trim();
  const cleanExe = String(executablePath ?? "").trim();
  const cleanInstall = String(installPath ?? "").trim();

  if (!cleanName) throw new Error("Game name is required.");
  if (!cleanExe) throw new Error("Executable path is required.");

  const game = {
    id: newId(),
    name: cleanName,
    store: "Manual",
    source: "manual",
    launcherId: null,
    executablePath: cleanExe,
    executable: cleanExe,
    installPath: cleanInstall,
    manual: true,
    addedAt: new Date().toISOString(),
  };

  const next = [...readAll(), game];
  writeAll(next);
  window.dispatchEvent(new CustomEvent("game-manager-manual-games-changed", { detail: { game } }));
  return game;
}

export function updateManualGame(id, changes) {
  const next = readAll().map((game) => game.id === id ? { ...game, ...changes, id: game.id, source: "manual", store: "Manual", manual: true } : game);
  writeAll(next);
  window.dispatchEvent(new CustomEvent("game-manager-manual-games-changed"));
  return next.find((game) => game.id === id) ?? null;
}

export function removeManualGame(id) {
  const next = readAll().filter((game) => game.id !== id);
  writeAll(next);
  window.dispatchEvent(new CustomEvent("game-manager-manual-games-changed"));
}
