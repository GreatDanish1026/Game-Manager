import {
  invoke,
} from "@tauri-apps/api/core";

const cache =
  new Map();

export async function getPcgwKnownIssues(
  pageName,
  {
    force = false,
  } = {}
) {
  const key =
    String(
      pageName
      ?? ""
    ).trim();

  if (!key) {
    return {
      unresolvedHtml: null,
      fixedHtml: null,
    };
  }

  if (
    !force
    && cache.has(key)
  ) {
    return cache.get(key);
  }

  const promise =
    invoke(
      "get_pcgw_known_issues",
      {
        pageName: key,
      }
    )
    .catch(
      (error) => {
        cache.delete(key);
        throw error;
      }
    );

  cache.set(
    key,
    promise
  );

  return promise;
}
