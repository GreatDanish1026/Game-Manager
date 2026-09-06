import { invoke } from "@tauri-apps/api/core";

export async function getInstalledGames() {
  console.log("Calling Rust game scanner...");

  const games = await invoke("get_installed_games");

  console.log("Rust returned:", games);

  return games;
}