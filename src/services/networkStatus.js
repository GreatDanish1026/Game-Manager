export function isNetworkOnline() {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return true;
  }

  return navigator.onLine
    !== false;
}


export function subscribeNetworkStatus(
  callback
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return () => {};
  }

  const update =
    () =>
      callback(
        isNetworkOnline()
      );

  window.addEventListener(
    "online",
    update
  );

  window.addEventListener(
    "offline",
    update
  );

  return () => {
    window.removeEventListener(
      "online",
      update
    );

    window.removeEventListener(
      "offline",
      update
    );
  };
}
