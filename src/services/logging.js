const DEV =
  import.meta.env.DEV;


export function devLog(
  ...args
) {
  if (DEV) {
    console.log(
      ...args
    );
  }
}


export function devInfo(
  ...args
) {
  if (DEV) {
    console.info(
      ...args
    );
  }
}


export function devWarn(
  ...args
) {
  if (DEV) {
    console.warn(
      ...args
    );
  }
}


/*
 * Keep user-impacting or actionable warnings/errors visible in both
 * development and production.
 */
export function warn(
  ...args
) {
  console.warn(
    ...args
  );
}


export function error(
  ...args
) {
  console.error(
    ...args
  );
}


/*
 * High-value performance timings remain development-only by default.
 * This avoids production console spam while preserving useful profiling
 * during development.
 */
export function perf(
  label,
  milliseconds
) {
  if (!DEV) {
    return;
  }

  const rounded =
    Number.isFinite(
      milliseconds
    )
      ? Math.round(
          milliseconds
        )
      : milliseconds;

  console.info(
    `[Performance] ${label}: ${rounded} ms`
  );
}
