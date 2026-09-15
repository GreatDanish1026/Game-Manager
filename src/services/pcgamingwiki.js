import {
  invoke,
} from "@tauri-apps/api/core";

const inFlight =
  new Map();

function requestKey(
  game
) {
  return [
    game.store ?? "",
    game.launcherId ?? "",
    game.name ?? "",
  ]
    .map(
      (value) =>
        String(value)
          .trim()
          .toLowerCase()
    )
    .join("::");
}

export async function getPcGamingWikiData(
  game
) {
  const key =
    requestKey(
      game
    );

  const pending =
    inFlight.get(
      key
    );

  if (pending) {
    return pending;
  }

  console.log(
    "[PCGW] Requesting data for:",
    game
  );

  const request =
    invoke(
      "get_pcgw_game_data",
      {
        name:
          game.name,

        store:
          game.store,

        launcherId:
          game.launcherId ??
          null,
      }
    )
      .finally(
        () => {
          if (
            inFlight.get(
              key
            ) === request
          ) {
            inFlight.delete(
              key
            );
          }
        }
      );

  inFlight.set(
    key,
    request
  );

  const result =
    await request;

  console.log(
    "[PCGW] Rust returned:",
    result
  );

  return result;
}
