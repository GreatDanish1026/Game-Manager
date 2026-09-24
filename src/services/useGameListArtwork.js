import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { getGameListArtworkCandidates, getSteamArtworkCandidates } from "./gameArtwork";

const CACHE_KEY = "gameatlas.steamArtworkMatches.v1";
const CACHE_AGE = 30 * 24 * 60 * 60 * 1000;
const pending = new Map();
const queue = [];
let active = 0;

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function cachedMatch(key) {
  const entry = readCache()[key];
  return entry && Date.now() - entry.savedAt < CACHE_AGE ? entry.appId : undefined;
}

function saveMatch(key, appId) {
  try {
    const cache = readCache();
    cache[key] = { appId, savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Artwork is optional; storage failures should not affect the library.
  }
}

function runQueue() {
  while (active < 2 && queue.length) {
    const task = queue.shift();
    active += 1;
    invoke("find_steam_app_id_for_artwork", { title: task.title })
      .then((appId) => {
        const result = Number.isSafeInteger(appId) && appId > 0 ? appId : null;
        saveMatch(task.key, result);
        task.resolve(result);
      })
      .catch(() => task.resolve(null))
      .finally(() => {
        active -= 1;
        pending.delete(task.key);
        runQueue();
      });
  }
}

function lookupSteamId(title) {
  const key = title.trim().toLocaleLowerCase();
  const cached = cachedMatch(key);
  if (cached !== undefined) return Promise.resolve(cached);
  if (pending.has(key)) return pending.get(key);
  const promise = new Promise((resolve) => {
    queue.push({ key, title, resolve });
    runQueue();
  });
  pending.set(key, promise);
  return promise;
}

export function useGameListArtwork(game, failedUrls = []) {
  const elementRef = useRef(null);
  const title = String(game?.name ?? "").trim();
  const store = String(game?.store ?? "").trim().toLowerCase();
  const knownSteamId = String(game?.steamAppId ?? "").trim();
  const candidates = getGameListArtworkCandidates(game);
  const localArtworkFailed = candidates.length === 0 || candidates.every((url) => failedUrls.includes(url));
  const shouldLookup = store !== "steam" && title.length >= 3
    && !/^\d+$/.test(knownSteamId) && localArtworkFailed;
  const [match, setMatch] = useState(null);

  useEffect(() => {
    setMatch(null);
    if (!shouldLookup) return undefined;
    let cancelled = false;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      lookupSteamId(title).then((appId) => {
        if (!cancelled) setMatch(appId);
      });
    };
    const element = elementRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      start();
      return () => { cancelled = true; };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    }, { rootMargin: "120px" });
    observer.observe(element);
    return () => { cancelled = true; observer.disconnect(); };
  }, [title, shouldLookup]);

  if (shouldLookup && match) candidates.push(...getSteamArtworkCandidates(match));
  return { elementRef, candidates };
}
