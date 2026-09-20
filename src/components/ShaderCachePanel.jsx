import {
  Check,
  DatabaseZap,
  FolderOpen,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  clearShaderCacheTargets,
  getShaderCacheReport,
} from "../services/shaderCache";

import {
  openGamePath,
} from "../services/pathActions";


function formatBytes(
  bytes
) {
  const value =
    Number(
      bytes
      ?? 0
    );

  if (
    !Number.isFinite(
      value
    )
    || value <= 0
  ) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  let amount =
    value;

  let unit =
    0;

  while (
    amount >= 1024
    && unit
      < units.length - 1
  ) {
    amount /=
      1024;

    unit +=
      1;
  }

  return `${amount.toFixed(
    unit === 0
      ? 0
      : 1
  )} ${units[unit]}`;
}


export default function ShaderCachePanel({
  game,
}) {
  const [
    report,
    setReport,
  ] =
    useState(null);

  const [
    selected,
    setSelected,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    clearing,
    setClearing,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState(null);

  const [
    error,
    setError,
  ] =
    useState(null);


  async function refresh({
    preserveSelection = false,
  } = {}) {
    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const next =
        await getShaderCacheReport(
          game
        );

      setReport(
        next
      );

      setSelected(
        (
          current
        ) => {
          if (
            preserveSelection
          ) {
            const ids =
              new Set(
                next.targets
                  .map(
                    (target) =>
                      target.id
                  )
              );

            return current
              .filter(
                (id) =>
                  ids.has(
                    id
                  )
              );
          }

          return next.targets
            .filter(
              (target) =>
                target.selectedByDefault
            )
            .map(
              (target) =>
                target.id
            );
        }
      );
    } catch (loadError) {
      setError(
        String(
          loadError
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  const selectedBytes =
    useMemo(
      () =>
        report?.targets
          ?.filter(
            (target) =>
              selected.includes(
                target.id
              )
          )
          .reduce(
            (
              total,
              target
            ) =>
              total
              + (
                target.sizeBytes
                ?? 0
              ),
            0
          )
        ?? 0,
      [
        report,
        selected,
      ]
    );


  if (
    !loading
    && report
    && !report.supported
  ) {
    return null;
  }


  function toggle(
    id
  ) {
    setSelected(
      (
        current
      ) =>
        current.includes(
          id
        )
          ? current.filter(
              (value) =>
                value !== id
            )
          : [
              ...current,
              id,
            ]
    );
  }


  async function handleOpen(
    path
  ) {
    try {
      await openGamePath(
        path,
        game?.installPath
      );
    } catch (openError) {
      setError(
        String(
          openError
        )
      );
    }
  }


  async function handleClear() {
    if (
      selected.length === 0
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Clear ${selected.length} selected shader-cache target${selected.length === 1 ? "" : "s"}?\n\nThe next game launch may stutter more while shaders are rebuilt.`
      );

    if (!confirmed) {
      return;
    }

    setClearing(
      true
    );

    setMessage(
      null
    );

    setError(
      null
    );

    try {
      const result =
        await clearShaderCacheTargets(
          game,
          selected
        );

      setMessage(
        `${result.message} Approximately ${formatBytes(
          result.bytesReclaimed
        )} was removed.`
      );

      if (
        result.failedTargets
          ?.length
      ) {
        setError(
          result.failedTargets
            .join(
              " • "
            )
        );
      }

      await refresh({
        preserveSelection:
          false,
      });
    } catch (clearError) {
      setError(
        String(
          clearError
        )
      );
    } finally {
      setClearing(
        false
      );
    }
  }


  return (
    <div
      className="
        mt-5
        overflow-hidden
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          border-b
          border-white/[0.06]
          p-4
          sm:flex-row
          sm:items-start
          sm:justify-between
        "
      >
        <div
          className="
            flex
            items-start
            gap-3
          "
        >
          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-violet-500/10
              text-violet-300
            "
          >
            <DatabaseZap
              className="h-5 w-5"
            />
          </div>

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white/75
              "
            >
              Shader Cache Management
            </div>

            <div
              className="
                mt-1
                max-w-3xl
                text-xs
                leading-relaxed
                text-white/35
              "
            >
              Detect and clear known platform, GPU-driver, Steam,
              and clearly named game-local shader/pipeline caches.
            </div>

            {report ? (
              <div
                className="
                  mt-2
                  text-xs
                  text-white/30
                "
              >
                {report.targets.length} cache target
                {report.targets.length === 1 ? "" : "s"}
                {" • "}
                {formatBytes(
                  report.totalSizeBytes
                )}
                {" • "}
                {report.totalFileCount.toLocaleString()} files
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={
            () =>
              refresh()
          }
          disabled={
            loading
            || clearing
          }
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-white/10
            bg-white/[0.035]
            px-3
            py-2
            text-xs
            font-semibold
            text-white/55
            hover:bg-white/[0.07]
            disabled:opacity-40
          "
        >
          <RefreshCw
            className={`
              h-3.5
              w-3.5
              ${
                loading
                  ? "animate-spin"
                  : ""
              }
            `}
          />

          {report
            ? "Rescan"
            : "Inspect Caches"}
        </button>
      </div>


      {report ? (
        <div
          className="
            flex
            gap-3
            border-b
            border-amber-500/10
            bg-amber-500/[0.035]
            px-4
            py-3
          "
        >
          <TriangleAlert
            className="
              mt-0.5
              h-4
              w-4
              shrink-0
              text-amber-300/75
            "
          />

          <div
            className="
              text-xs
              leading-relaxed
              text-amber-100/55
            "
          >
            {report.warning}
          </div>
        </div>
      ) : null}


      {error ? (
        <div
          className="
            border-b
            border-red-500/10
            bg-red-500/[0.04]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-red-200/70
          "
        >
          {error}
        </div>
      ) : null}


      {message ? (
        <div
          className="
            border-b
            border-emerald-500/10
            bg-emerald-500/[0.035]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-emerald-100/60
          "
        >
          {message}
        </div>
      ) : null}


      {loading
        && !report ? (
        <div
          className="
            flex
            items-center
            gap-3
            p-4
            text-sm
            text-white/35
          "
        >
          <Loader2
            className="
              h-4
              w-4
              animate-spin
            "
          />

          Inspecting shader-cache locations…
        </div>
      ) : null}


      {report ? (
        <>
          <div
            className="
              p-4
            "
          >
            {report.targets.length > 0 ? (
              <div
                className="
                  space-y-2
                "
              >
                {report.targets.map(
                  (
                    target
                  ) => {
                    const checked =
                      selected.includes(
                        target.id
                      );

                    return (
                      <div
                        key={
                          target.id
                        }
                        className={`
                          rounded-lg
                          border
                          px-3
                          py-3
                          ${
                            checked
                              ? "border-cyan-400/20 bg-cyan-400/[0.04]"
                              : "border-white/[0.07] bg-black/10"
                          }
                        `}
                      >
                        <div
                          className="
                            flex
                            flex-col
                            gap-3
                            sm:flex-row
                            sm:items-start
                            sm:justify-between
                          "
                        >
                          <button
                            type="button"
                            onClick={
                              () =>
                                toggle(
                                  target.id
                                )
                            }
                            disabled={
                              clearing
                            }
                            className="
                              flex
                              min-w-0
                              flex-1
                              items-start
                              gap-3
                              text-left
                              disabled:opacity-40
                            "
                          >
                            <div
                              className={`
                                mt-0.5
                                flex
                                h-4
                                w-4
                                shrink-0
                                items-center
                                justify-center
                                rounded
                                border
                                ${
                                  checked
                                    ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-200"
                                    : "border-white/15 bg-white/[0.02] text-transparent"
                                }
                              `}
                            >
                              <Check
                                className="h-3 w-3"
                              />
                            </div>

                            <div
                              className="
                                min-w-0
                              "
                            >
                              <div
                                className="
                                  flex
                                  flex-wrap
                                  items-center
                                  gap-2
                                "
                              >
                                <div
                                  className="
                                    text-xs
                                    font-semibold
                                    text-white/70
                                  "
                                >
                                  {target.name}
                                </div>

                                <span
                                  className={`
                                    rounded-full
                                    border
                                    px-2
                                    py-0.5
                                    text-[10px]
                                    ${
                                      target.scope === "Game"
                                        ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-200/60"
                                        : "border-white/[0.08] bg-white/[0.03] text-white/35"
                                    }
                                  `}
                                >
                                  {target.scope}
                                </span>

                                {target.vendor ? (
                                  <span
                                    className="
                                      rounded-full
                                      border
                                      border-white/[0.08]
                                      bg-white/[0.03]
                                      px-2
                                      py-0.5
                                      text-[10px]
                                      text-white/35
                                    "
                                  >
                                    {target.vendor}
                                  </span>
                                ) : null}
                              </div>

                              <div
                                className="
                                  mt-1
                                  text-[10px]
                                  text-white/28
                                "
                              >
                                {formatBytes(
                                  target.sizeBytes
                                )}
                                {" • "}
                                {target.fileCount.toLocaleString()} files
                              </div>

                              <div
                                className="
                                  mt-1
                                  break-all
                                  text-[10px]
                                  text-white/20
                                "
                              >
                                {target.path}
                              </div>

                              <div
                                className="
                                  mt-1.5
                                  text-xs
                                  leading-relaxed
                                  text-white/32
                                "
                              >
                                {target.note}
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={
                              () =>
                                handleOpen(
                                  target.openPath
                                  ?? target.path
                                )
                            }
                            className="
                              inline-flex
                              shrink-0
                              items-center
                              gap-1.5
                              rounded-lg
                              border
                              border-white/[0.08]
                              bg-white/[0.025]
                              px-2.5
                              py-1.5
                              text-[10px]
                              font-semibold
                              text-white/45
                              hover:bg-white/[0.06]
                              hover:text-white/70
                            "
                          >
                            <FolderOpen
                              className="h-3 w-3"
                            />

                            Open
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <div
                className="
                  rounded-lg
                  border
                  border-dashed
                  border-white/[0.08]
                  px-3
                  py-5
                  text-center
                  text-xs
                  text-white/30
                "
              >
                No recognized shader-cache locations currently exist.
              </div>
            )}
          </div>


          <div
            className="
              flex
              flex-col
              gap-3
              border-t
              border-white/[0.06]
              p-4
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div
              className="
                text-xs
                text-white/28
              "
            >
              Selected: {selected.length}
              {" • "}
              approximately {formatBytes(
                selectedBytes
              )}
            </div>

            <button
              type="button"
              onClick={
                handleClear
              }
              disabled={
                clearing
                || selected.length === 0
              }
              className="
                inline-flex
                items-center
                gap-2
                rounded-lg
                border
                border-red-400/20
                bg-red-400/[0.06]
                px-3
                py-2
                text-xs
                font-semibold
                text-red-100/75
                hover:bg-red-400/[0.10]
                disabled:opacity-35
              "
            >
              {clearing ? (
                <Loader2
                  className="
                    h-3.5
                    w-3.5
                    animate-spin
                  "
                />
              ) : (
                <Trash2
                  className="h-3.5 w-3.5"
                />
              )}

              {clearing
                ? "Clearing…"
                : "Clear Selected Caches"
              }
            </button>
          </div>


          <div
            className="
              border-t
              border-white/[0.06]
              px-4
              py-3
              text-[10px]
              leading-relaxed
              text-white/22
            "
          >
            GameAtlas only exposes known driver/system shader caches
            and clearly named game-local shader or pipeline caches.
            System-wide caches are never selected automatically.
          </div>
        </>
      ) : null}
    </div>
  );
}
